import "../src/lib/env.js";
import { optionalEnv } from "../src/lib/env.js";

async function main(): Promise<void> {
  const key = optionalEnv("WASSIST_API_KEY");
  const agentId = optionalEnv("WASSIST_AGENT_ID");
  if (!key || !agentId) return;

  const res = await fetch(
    `https://backend.wassist.app/api/v1/agents/${agentId}/`,
    { headers: { "X-API-Key": key } },
  );
  const agent = await res.json();
  console.log(JSON.stringify(agent, null, 2).slice(0, 3000));
}

main();
