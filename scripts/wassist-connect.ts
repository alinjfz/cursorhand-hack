import "../src/lib/env.js";
import { optionalEnv } from "../src/lib/env.js";

async function main(): Promise<void> {
  const key = optionalEnv("WASSIST_API_KEY");
  const agentId = optionalEnv("WASSIST_AGENT_ID");
  if (!key || !agentId) {
    console.log("Set WASSIST_API_KEY and WASSIST_AGENT_ID in .env");
    return;
  }

  const res = await fetch(
    `https://backend.wassist.app/api/v1/agents/${agentId}/`,
    { headers: { "X-API-Key": key } },
  );
  const agent = (await res.json()) as {
    name?: string;
    connectUrl?: string;
    phoneNumbers?: unknown[];
    owner?: { phoneNumber?: string };
  };

  console.log(`Agent: ${agent.name}`);
  console.log(`Deployed numbers: ${agent.phoneNumbers?.length ?? 0}`);

  if (agent.phoneNumbers?.length) {
    console.log("WhatsApp is connected — run: npm run approach");
    return;
  }

  console.log("\n⚠️  No WhatsApp number on this agent. Outreach cannot send yet.\n");
  console.log("Fix (pick one):\n");
  console.log("A) Wassist dashboard → WhatsApp Accounts → Connect");
  console.log("   → Free test number OR Wassist UK line → Deploy agent\n");
  console.log("B) Open this link on your phone FIRST (starts a session):");
  console.log(`   ${agent.connectUrl ?? "—"}`);
  console.log("\n   Then run: npm run approach\n");
  console.log(`Your DEMO_PHONE: ${optionalEnv("DEMO_PHONE") ?? "not set"}`);
}

main();
