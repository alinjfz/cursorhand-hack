import "../src/lib/env.js";
import { optionalEnv } from "../src/lib/env.js";

async function main(): Promise<void> {
  const key = optionalEnv("WASSIST_API_KEY");
  const agentId = optionalEnv("WASSIST_AGENT_ID");
  const phone = optionalEnv("DEMO_PHONE");
  if (!key || !agentId || !phone) return;

  const fromNumber = optionalEnv("WASSIST_FROM_NUMBER") ?? "+447424845871";

  const res = await fetch("https://backend.wassist.app/api/v1/conversations/", {
    method: "POST",
    headers: {
      "X-API-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      toNumber: phone,
      fromNumber,
    }),
  });

  console.log("Status:", res.status);
  console.log(await res.text());
}

main();
