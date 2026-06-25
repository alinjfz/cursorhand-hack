import "../src/lib/env.js";
import { optionalEnv } from "../src/lib/env.js";
import { sendOutreachMessage } from "../src/lib/wassist.js";
import { ensureDemoLead } from "../src/lib/demo.js";
import { updateLead } from "../src/lib/supabase.js";
import { sitePublicUrl } from "../src/lib/deploy.js";

async function main(): Promise<void> {
  const phone = optionalEnv("DEMO_PHONE");
  if (!phone) throw new Error("DEMO_PHONE not set");

  const lead = await ensureDemoLead();
  const url =
    lead.deployment_url ?? sitePublicUrl("ali-s-hackathon-cafe");

  console.log(`Sending to ${phone}...`);
  console.log(`Site: ${url}`);

  await sendOutreachMessage(phone, lead.name, url);

  if (lead.id) {
    await updateLead(lead.id, { status: "CONTACTED", deployment_url: url });
  }

  console.log("✓ Message sent — check WhatsApp");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
