import "../src/lib/env.js";
import { ensureDemoLead } from "../src/lib/demo.js";
import { updateLead } from "../src/lib/supabase.js";
import { sitePublicUrl } from "../src/lib/deploy.js";

async function main(): Promise<void> {
  const lead = await ensureDemoLead();
  if (!lead) throw new Error("DEMO_PHONE not set");

  const url = sitePublicUrl("ali-s-hackathon-cafe");
  const updated = await updateLead(lead.id, {
    status: "CONTACTED",
    deployment_url: url,
    paypal_order_id: null,
    paypal_checkout_url: null,
    wassist_reply_callback: null,
  });

  console.log(`Reset ${updated.name} → CONTACTED`);
  console.log(updated.phone);
  console.log(url);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
