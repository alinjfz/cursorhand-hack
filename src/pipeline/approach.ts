import { getLeadsByStatusDemoFirst } from "../lib/demo.js";
import { updateLead } from "../lib/supabase.js";
import { sendOutreachMessage } from "../lib/wassist.js";

export interface ApproachOptions {
  limit?: number;
}

export async function runApproach(options: ApproachOptions = {}): Promise<void> {
  const { limit = 3 } = options;

  const leads = await getLeadsByStatusDemoFirst("SITE_READY", limit);
  if (leads.length === 0) {
    console.log("No SITE_READY leads to approach. Run build first.");
    return;
  }

  console.log(`Approaching ${leads.length} lead(s)...`);

  for (const lead of leads) {
    if (!lead.deployment_url) {
      console.log(`Skipping ${lead.name}: no deployment_url`);
      continue;
    }

    try {
      console.log(`Sending WhatsApp to ${lead.phone}...`);
      await sendOutreachMessage(lead.phone, lead.name, lead.deployment_url);

      await updateLead(lead.id, { status: "CONTACTED" });
      console.log(`  ✓ ${lead.name} — CONTACTED`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Approach failed for ${lead.name}: ${message}`);
      await updateLead(lead.id, { status: "FAILED", error_message: message });
    }
  }

  console.log("Approach phase complete");
}
