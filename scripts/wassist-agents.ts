#!/usr/bin/env tsx
import "../src/lib/env.js";
import { optionalEnv } from "../src/lib/env.js";

async function main(): Promise<void> {
  const key = optionalEnv("WASSIST_API_KEY");
  if (!key) {
    console.log("WASSIST_API_KEY not set");
    return;
  }

  const response = await fetch("https://backend.wassist.app/api/v1/agents/", {
    headers: { "X-API-Key": key },
  });

  if (!response.ok) {
    console.error(`Wassist error ${response.status}: ${await response.text()}`);
    return;
  }

  const data = (await response.json()) as {
    results?: Array<{ id: string; name: string }>;
  };

  const agents = data.results ?? [];
  if (agents.length === 0) {
    console.log("No agents found. Create one at wassist.app");
    return;
  }

  for (const a of agents) {
    console.log(`${a.name}: ${a.id}`);
  }
  console.log(`\nAdd to .env:\nWASSIST_AGENT_ID=${agents[0].id}`);
}

main();
