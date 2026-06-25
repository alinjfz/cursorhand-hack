import "../src/lib/env.js";
import { optionalEnv } from "../src/lib/env.js";
import { sendSessionMessage } from "../src/lib/wassist.js";
import { sitePublicUrl } from "../src/lib/deploy.js";
import { ensureDemoLead } from "../src/lib/demo.js";
import { updateLead } from "../src/lib/supabase.js";

async function main(): Promise<void> {
  const phone = optionalEnv("DEMO_PHONE");
  if (!phone) throw new Error("DEMO_PHONE not set");

  const lead = await ensureDemoLead();
  const url = sitePublicUrl("ali-s-hackathon-cafe");
  const text = `Quick fix — the correct link for your demo site is: ${url}\n\nReply YES when you're ready to claim it.`;

  console.log(`Correction to ${phone}\n${url}`);

  await sendSessionMessage(phone, text);

  if (lead.id) {
    await updateLead(lead.id, {
      status: "CONTACTED",
      deployment_url: url,
    });
  }

  console.log("✓ Sent");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
