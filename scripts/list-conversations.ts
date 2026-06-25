import "../src/lib/env.js";
import { optionalEnv } from "../src/lib/env.js";

async function main(): Promise<void> {
  const key = optionalEnv("WASSIST_API_KEY");
  const agentId = optionalEnv("WASSIST_AGENT_ID");
  if (!key || !agentId) return;

  const res = await fetch(
    `https://backend.wassist.app/api/v1/conversations/?agent=${agentId}`,
    { headers: { "X-API-Key": key } },
  );
  const data = (await res.json()) as {
    results?: Array<{
      id: string;
      contact?: { phoneNumber?: string; name?: string };
    }>;
  };
  for (const c of data.results ?? []) {
    console.log(c.id, c.contact?.name ?? "?", c.contact?.phoneNumber ?? "?");
  }
}

main();
