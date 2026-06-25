import { ensureDemoLead } from "../lib/demo.js";
import { runBuild } from "./build.js";
import { runApproach } from "./approach.js";
import { optionalEnv } from "../lib/env.js";

export async function runDemo(): Promise<void> {
  const phone = optionalEnv("DEMO_PHONE");
  if (!phone) {
    throw new Error("Set DEMO_PHONE in .env to your WhatsApp number");
  }

  console.log(`Demo target: ${phone}\n`);

  const lead = await ensureDemoLead();
  console.log(`✓ Demo lead ready: ${lead?.name} (${lead?.phone})\n`);

  const buildProvider = "static";

  console.log(`▶ Build (${buildProvider} — demo lead first, no API credits needed)`);
  await runBuild({ limit: 2, provider: buildProvider });

  console.log("\n▶ Approach (WhatsApp — you first)");
  await runApproach({ limit: 3 });

  console.log("\n═══ Demo run complete ═══");
  console.log("Check WhatsApp. Reply YES to trigger PayPal checkout.");
  console.log(`Dashboard: ${optionalEnv("WEBHOOK_BASE_URL") ?? "http://localhost"}/#dashboard`);
}
