#!/usr/bin/env node
import { Command } from "commander";
import "./lib/env.js";
import { runHunt } from "./pipeline/hunt.js";
import { runBuild } from "./pipeline/build.js";
import { runApproach } from "./pipeline/approach.js";
import { runDemo } from "./pipeline/demo.js";
import { getLeadsByStatus, updateLead } from "./lib/supabase.js";
import { captureOrder } from "./lib/paypal.js";
import { describeConfiguredProviders, getBuildProvider, getLlmProvider, getWassistMode, hasWassistOutboundTemplates } from "./lib/config.js";
import { hasSupabaseReadAccess, hasSupabaseWriteAccess } from "./lib/env.js";

const program = new Command();

program
  .name("cursorhand")
  .description("Hands Off Web Agency — hunt, build, approach, payday")
  .version("1.0.0");

program
  .command("status")
  .description("Show which providers are configured from .env")
  .action(() => {
    console.log(describeConfiguredProviders());
    console.log("");
    console.log("Build provider:", getBuildProvider());
    console.log("LLM provider:", getLlmProvider() ?? "none");
    console.log("Supabase write:", hasSupabaseWriteAccess() ? "yes" : "no");
    console.log("Supabase read:", hasSupabaseReadAccess() ? "yes" : "no");
    console.log("Wassist mode:", getWassistMode());
    console.log("Wassist outbound templates:", hasWassistOutboundTemplates() ? "yes" : "no");
  });

program
  .command("hunt")
  .description("Find London leads with no website (Overpass API or CSV)")
  .option("-q, --query <query>", "Search query for Overpass")
  .option("-l, --limit <number>", "Max results", "20")
  .option("-s, --source <source>", "overpass | csv", "overpass")
  .option("--csv <path>", "CSV path when --source csv", "mydocs/leads.csv")
  .option("--seed", "Use pre-seeded Supabase leads only")
  .action(async (opts) => {
    await runHunt({
      query: opts.query,
      limit: parseInt(opts.limit, 10),
      seed: opts.seed,
      source: opts.source as "overpass" | "csv",
      csv: opts.csv,
    });
  });

program
  .command("build")
  .description("Generate and deploy sites for NEW leads")
  .option("-l, --limit <number>", "Max leads to build", "1")
  .option("--skip-deploy", "Generate HTML only, skip deploy")
  .option(
    "-p, --provider <provider>",
    "manus | llm-vercel | static | auto (default: auto)",
    "auto",
  )
  .action(async (opts) => {
    await runBuild({
      limit: parseInt(opts.limit, 10),
      skipDeploy: opts.skipDeploy,
      provider: opts.provider as "manus" | "llm-vercel" | "static" | "auto",
    });
  });

program
  .command("approach")
  .description("Send WhatsApp outreach to SITE_READY leads")
  .option("-l, --limit <number>", "Max leads to contact", "3")
  .action(async (opts) => {
    await runApproach({ limit: parseInt(opts.limit, 10) });
  });

program
  .command("pipeline")
  .description("Run hunt → build → approach (semi-auto demo)")
  .option("-q, --query <query>", "Search query for Overpass hunt")
  .option("--seed", "Skip hunt, use pre-seeded leads")
  .option("-s, --source <source>", "overpass | csv", "csv")
  .option("--csv <path>", "CSV path when --source csv", "mydocs/leads.csv")
  .option("-b, --build-limit <number>", "Sites to build", "1")
  .option("-a, --approach-limit <number>", "Leads to contact", "1")
  .action(async (opts) => {
    console.log("═══ Hands Off Pipeline ═══");
    console.log(describeConfiguredProviders());
    console.log("");

    console.log("▶ Phase 1: Hunt");
    await runHunt({
      query: opts.query,
      limit: 20,
      seed: opts.seed,
      source: opts.source as "overpass" | "csv",
      csv: opts.csv,
    });

    console.log("\n▶ Phase 2: Build");
    await runBuild({ limit: parseInt(opts.buildLimit, 10) });

    console.log("\n▶ Phase 3: Approach");
    await runApproach({ limit: parseInt(opts.approachLimit, 10) });

    console.log("\n═══ Pipeline complete ═══");
    console.log("Reply YES on WhatsApp to trigger PayPal checkout.");
  });

program
  .command("demo")
  .description("Live proof: build site for DEMO_PHONE + WhatsApp outreach (you first)")
  .action(async () => {
    await runDemo();
  });

program
  .command("payday")
  .description("Poll WhatsApp for YES and send PayPal (sandbox /connect agents)")
  .option("--phone <phone>", "Phone to watch (default: DEMO_PHONE)")
  .option("--agent <id>", "Wassist agent ID", "b8f4eda9-6bbe-43fc-870e-fa43ac19d4af")
  .option("--timeout <seconds>", "How long to wait for YES", "120")
  .action(async (opts) => {
    const { optionalEnv } = await import("./lib/env.js");
    const { getLeadByPhone, updateLead } = await import("./lib/supabase.js");
    const { createCheckoutOrder } = await import("./lib/paypal.js");
    const { sendPaymentMessage } = await import("./lib/wassist.js");
    const { waitForInboundYes } = await import("./lib/wassist-inbox.js");

    const phone = opts.phone ?? optionalEnv("DEMO_PHONE");
    if (!phone) throw new Error("Set DEMO_PHONE or pass --phone");

    console.log(`Watching for YES from ${phone} (agent ${opts.agent})...`);
    await waitForInboundYes(opts.agent, phone, {
      timeoutMs: parseInt(opts.timeout, 10) * 1000,
    });

    const lead = await getLeadByPhone(phone);
    if (!lead) throw new Error(`No lead for ${phone}`);

    await updateLead(lead.id, { status: "INTERESTED" });
    const { orderId, checkoutUrl } = await createCheckoutOrder(lead.name);
    await updateLead(lead.id, {
      status: "INVOICED",
      paypal_order_id: orderId,
      paypal_checkout_url: checkoutUrl,
    });
    await sendPaymentMessage(phone, checkoutUrl);
    console.log(`✓ PayPal link sent: ${checkoutUrl}`);
  });

program
  .command("capture")
  .description("Manually mark a lead as PAID or capture PayPal order")
  .option("--lead-id <id>", "Lead UUID to mark PAID")
  .option("--capture <orderId>", "Capture PayPal order and mark lead PAID")
  .action(async (opts) => {
    if (opts.capture) {
      const success = await captureOrder(opts.capture);
      console.log(`Capture ${success ? "succeeded" : "pending"}`);

      const invoiced = await getLeadsByStatus("INVOICED", 100);
      const lead = invoiced.find((l) => l.paypal_order_id === opts.capture);
      if (lead && success) {
        await updateLead(lead.id, { status: "PAID" });
        console.log(`Lead ${lead.name} marked PAID`);
      }
      return;
    }

    if (opts.leadId) {
      await updateLead(opts.leadId, { status: "PAID" });
      console.log(`Lead ${opts.leadId} marked PAID`);
      return;
    }

    console.log("Provide --lead-id <id> or --capture <orderId>");
  });

program.parse();
