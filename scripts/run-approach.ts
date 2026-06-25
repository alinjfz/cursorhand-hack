import { runApproach } from "../pipeline/approach.js";

async function main(): Promise<void> {
  await runApproach({ limit: 3 });
}

main();
