import "../src/lib/env.js";
import { processPayday } from "../src/pipeline/payday.js";

async function main(): Promise<void> {
  const result = await processPayday({
    message: "yes",
    phone_number: "+447594295357",
    reply_callback: "https://example.com/callback",
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error("ERR:", e instanceof Error ? e.stack ?? e.message : e);
  process.exit(1);
});
