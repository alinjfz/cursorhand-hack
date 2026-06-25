import "../src/lib/env.js";
import { optionalEnv } from "../src/lib/env.js";
import { listConversationMessages } from "../src/lib/wassist-inbox.js";

async function main(): Promise<void> {
  const id = "5b2d08dd-f5f8-4058-b982-f2b8e99feb25";
  const messages = await listConversationMessages(id, 20);
  console.log(`messages: ${messages.length}`);
  for (const m of messages) {
    console.log({ role: m.role, type: m.type, text: m.text, createdAt: m.createdAt });
  }
}

main().catch((e) => console.error(e instanceof Error ? e.message : e));
