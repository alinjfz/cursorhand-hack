import { getLeadsByStatus, updateLead } from "../lib/supabase.js";
import { generateSiteHtml } from "../lib/llm.js";
import { writeSiteToTemp, deployToVercel } from "../lib/deploy.js";

export interface BuildOptions {
  limit?: number;
  skipDeploy?: boolean;
}

export async function runBuild(options: BuildOptions = {}): Promise<void> {
  const { limit = 1, skipDeploy = false } = options;

  const leads = await getLeadsByStatus("NEW", limit);
  if (leads.length === 0) {
    console.log("No NEW leads to build. Run hunt first or check Supabase.");
    return;
  }

  console.log(`Building ${leads.length} site(s)...`);

  for (const lead of leads) {
    console.log(`\n── ${lead.name} (${lead.id}) ──`);

    try {
      await updateLead(lead.id, { status: "BUILDING" });

      const html = await generateSiteHtml(
        {
          name: lead.name,
          full_address: lead.full_address ?? "London, UK",
          niche: lead.niche ?? "local business",
        },
        (chunk) => process.stdout.write(chunk),
      );

      const siteDir = writeSiteToTemp(lead.id, html);
      console.log(`Wrote HTML to ${siteDir}`);

      if (skipDeploy) {
        console.log("Skipping deploy (--skip-deploy)");
        await updateLead(lead.id, { status: "SITE_READY" });
        continue;
      }

      console.log("Deploying to Vercel...");
      const deploymentUrl = deployToVercel(siteDir);
      console.log(`Deployed: ${deploymentUrl}`);

      await updateLead(lead.id, {
        status: "SITE_READY",
        deployment_url: deploymentUrl,
        error_message: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Build failed for ${lead.name}: ${message}`);
      await updateLead(lead.id, { status: "FAILED", error_message: message });
    }
  }

  console.log("\nBuild phase complete");
}
