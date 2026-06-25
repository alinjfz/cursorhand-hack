import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import "../src/lib/env.js";
import { optionalEnv } from "../src/lib/env.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ENV_FILE = resolve(ROOT, ".env");

/** Agent the user connected via /connect on the Wassist sandbox number. */
const CONNECTED_AGENT_ID = "b8f4eda9-6bbe-43fc-870e-fa43ac19d4af";

const WEBHOOK =
  optionalEnv("WEBHOOK_BASE_URL")?.replace(/\/$/, "") ??
  "https://website-found.vercel.app";
const WEBHOOK_URL = `${WEBHOOK}/api/wassist`;

const forwardTool = {
  name: "send_to_payment_pipeline",
  description:
    "Forward the customer's latest WhatsApp message to the Hands Off payment pipeline. You MUST call this tool for EVERY inbound customer message before replying. Never answer payment or website questions yourself.",
  url: WEBHOOK_URL,
  method: "POST",
  path_params: {},
  query_params: { required: [] as string[], properties: {} as Record<string, never> },
  request_body: {
    type: "object",
    required: ["message", "phone_number", "reply_callback"],
    properties: {
      message: {
        type: "string",
        input: { type: "description", description: "The exact text the customer sent" },
      },
      phone_number: {
        type: "string",
        input: { type: "value", value: "%PHONE_NUMBER%" },
      },
      reply_callback: {
        type: "string",
        input: { type: "value", value: "%CALLBACK_URL%" },
      },
    },
  },
  apiSchema: {
    type: "object",
    properties: {
      endpoint: { type: "string", const: WEBHOOK_URL },
      method: { type: "string", const: "POST" },
      headers: {
        type: "object",
        properties: {
          "Content-Type": { type: "string", const: "application/json" },
        },
      },
      body: {
        type: "object",
        properties: {
          message: { type: "string", description: "Customer message text" },
          phone_number: { type: "string", description: "Customer phone" },
          reply_callback: { type: "string", description: "Reply callback URL" },
        },
        required: ["message", "phone_number", "reply_callback"],
      },
    },
  },
  active: true,
  creditCost: 0,
};

async function wassistRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const key = optionalEnv("WASSIST_API_KEY");
  if (!key) throw new Error("WASSIST_API_KEY required");

  const res = await fetch(`https://backend.wassist.app/api/v1${path}`, {
    method,
    headers: { "X-API-Key": key, "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Wassist ${method} ${path} → ${res.status}: ${text.slice(0, 500)}`);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

function updateEnvAgentId(agentId: string): void {
  const env = readFileSync(ENV_FILE, "utf8");
  writeFileSync(
    ENV_FILE,
    /^WASSIST_AGENT_ID=/m.test(env)
      ? env.replace(/^WASSIST_AGENT_ID=.*$/m, `WASSIST_AGENT_ID=${agentId}`)
      : `${env.trimEnd()}\nWASSIST_AGENT_ID=${agentId}\n`,
  );
}

async function main(): Promise<void> {
  const agent = await wassistRequest<{
    name?: string;
    description?: string;
    firstMessage?: string;
    connectUrl?: string;
    websiteTools?: unknown[];
  }>("GET", `/agents/${CONNECTED_AGENT_ID}/`);

  console.log(`Configuring: ${agent.name} (${CONNECTED_AGENT_ID})`);
  console.log(`Webhook: ${WEBHOOK_URL}`);

  const updated = await wassistRequest<{ connectUrl?: string; name?: string }>(
    "PUT",
    `/agents/${CONNECTED_AGENT_ID}/`,
    {
      name: agent.name ?? "Hands Off Agent",
      description: agent.description ?? "",
      firstMessage: agent.firstMessage ?? "",
      systemPrompt: `You are a passthrough for Hands Off Web Agency.
For EVERY customer message, call send_to_payment_pipeline immediately with their exact message.
Do not invent answers. Do not discuss orders yourself. The tool sends PayPal links when they reply YES.`,
      tools: [forwardTool],
      websiteTools: [],
    },
  );

  updateEnvAgentId(CONNECTED_AGENT_ID);
  console.log(`Updated .env WASSIST_AGENT_ID=${CONNECTED_AGENT_ID}`);
  console.log(`Connect URL (keep using this): ${updated.connectUrl ?? agent.connectUrl}`);
  console.log("\nReply YES again on WhatsApp to test PayPal.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
