import "../src/lib/env.js";
import { optionalEnv } from "../src/lib/env.js";

const CONNECTED_AGENT_ID = "b8f4eda9-6bbe-43fc-870e-fa43ac19d4af";

async function main(): Promise<void> {
  const key = optionalEnv("WASSIST_API_KEY");
  const agentId = optionalEnv("WASSIST_AGENT_ID") ?? CONNECTED_AGENT_ID;
  if (!key) {
    console.log("Set WASSIST_API_KEY in .env");
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
  };

  console.log(`Agent: ${agent.name} (${agentId})`);
  console.log(`Mode: sandbox /connect — Wassist AI handles replies, not the webhook`);
  console.log(`Your connect link: ${agent.connectUrl ?? `https://wa.me/447424845871?text=/connect:${agentId}`}`);
  console.log(`\nAfter you reply YES on WhatsApp, run:`);
  console.log(`  npm run process:yes     # send PayPal immediately`);
  console.log(`  npm run payday          # wait up to 2 min for YES, then send PayPal`);
  console.log(`\nDEMO_PHONE: ${optionalEnv("DEMO_PHONE") ?? "not set"}`);
}

main();
