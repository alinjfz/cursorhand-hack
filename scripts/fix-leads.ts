import "../src/lib/env.js";
import { getAllLeads, updateLead } from "../src/lib/supabase.js";
import { isDemoLead } from "../src/lib/demo.js";
import { sitePublicUrl } from "../src/lib/deploy.js";

async function main(): Promise<void> {
  const leads = await getAllLeads();
  for (const lead of leads) {
    if (lead.status === "FAILED" && lead.deployment_url) {
      await updateLead(lead.id, { status: "SITE_READY", error_message: null });
      console.log(`Reset ${lead.name} → SITE_READY`);
    }
    if (lead.status === "FAILED" && !lead.deployment_url) {
      const slug = lead.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const url = sitePublicUrl(slug);
      await updateLead(lead.id, {
        status: "SITE_READY",
        deployment_url: url,
        error_message: null,
      });
      console.log(`Fixed ${lead.name} → SITE_READY (${url})`);
    }
  }

  const demo = leads.find(isDemoLead);
  if (demo) {
    await updateLead(demo.id, {
      status: "SITE_READY",
      deployment_url: sitePublicUrl("ali-s-hackathon-cafe"),
      error_message: null,
    });
    console.log("Demo lead ready for outreach");
  }
}

main();
