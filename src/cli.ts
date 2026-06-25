#!/usr/bin/env node
import { Command } from "commander";
import "./lib/env.js";
import { runHunt } from "./pipeline/hunt.js";
import { runBuild } from "./pipeline/build.js";
import { runApproach } from "./pipeline/approach.js";
import { getLeadsByStatus, updateLead } from "./lib/supabase.js";
import { captureOrder } from "./lib/paypal.js";

const program = new Command();

program
  .name("cursorhand")
  .description("Hands Off Web Agency — hunt, build, approach, payday")
  .version("1.0.0");

program
  .command("hunt")
  .description("Scrape London leads with no website via Outscraper")
  .option("-q, --query <query>", "Outscraper search query")
  .option("-l, --limit <number>", "Max results", "20")
  .option("--seed", "Use pre-seeded leads instead of Outscraper")
  .action(async (opts) => {
    await runHunt({
      query: opts.query,
      limit: parseInt(opts.limit, 10),
      seed: opts.seed,
    });
  });

program
  .command("build")
  .description("Generate and deploy sites for NEW leads")
  .option("-l, --limit <number>", "Max leads to build", "1")
  .option("--skip-deploy", "Generate HTML only, skip Vercel deploy")
  .action(async (opts) => {
    await runBuild({
      limit: parseInt(opts.limit, 10),
      skipDeploy: opts.skipDeploy,
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
  .option("-q, --query <query>", "Outscraper search query")
  .option("--seed", "Skip hunt, use pre-seeded leads")
  .option("-b, --build-limit <number>", "Sites to build", "1")
  .option("-a, --approach-limit <number>", "Leads to contact", "1")
  .action(async (opts) => {
    console.log("═══ Hands Off Pipeline ═══\n");

    console.log("▶ Phase 1: Hunt");
    await runHunt({
      query: opts.query,
      limit: 20,
      seed: opts.seed,
    });

    console.log("\n▶ Phase 2: Build");
    await runBuild({ limit: parseInt(opts.buildLimit, 10) });

    console.log("\n▶ Phase 3: Approach");
    await runApproach({ limit: parseInt(opts.approachLimit, 10) });

    console.log("\n═══ Pipeline complete ═══");
    console.log("Reply YES on WhatsApp to trigger PayPal checkout.");
  });

program
  .command("payday")
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
