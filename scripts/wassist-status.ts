import "../src/lib/env.js";
import { optionalEnv } from "../src/lib/env.js";

async function main(): Promise<void> {
  const key = optionalEnv("WASSIST_API_KEY");
  if (!key) return;

  for (const path of ["/agents/", "/whatsapp-accounts/", "/whatsapp-numbers/"]) {
    console.log(`\n=== ${path} ===`);
    const res = await fetch(`https://backend.wassist.app/api/v1${path}`, {
      headers: { "X-API-Key": key },
    });
    console.log(res.status, (await res.text()).slice(0, 800));
  }
}

main();
