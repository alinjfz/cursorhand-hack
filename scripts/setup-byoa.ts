import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import "../src/lib/env.js";
import { optionalEnv } from "../src/lib/env.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ENV_FILE = resolve(ROOT, ".env");

const WEBHOOK =
  optionalEnv("WEBHOOK_BASE_URL")?.replace(/\/$/, "") ??
  "https://website-found.vercel.app";
const WEBHOOK_URL = `${WEBHOOK}/api/wassist`;

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
    throw new Error(`Wassist ${method} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

function updateEnvAgentId(agentId: string): void {
  const env = readFileSync(ENV_FILE, "utf8");
  if (/^WASSIST_AGENT_ID=/m.test(env)) {
    writeFileSync(
      ENV_FILE,
      env.replace(/^WASSIST_AGENT_ID=.*$/m, `WASSIST_AGENT_ID=${agentId}`),
    );
  } else {
    writeFileSync(ENV_FILE, `${env.trimEnd()}\nWASSIST_AGENT_ID=${agentId}\n`);
  }
}

async function findExistingByoa(): Promise<{ id: string; connectUrl?: string } | null> {
  const list = await wassistRequest<{
    results?: Array<{ id: string; name?: string; connectUrl?: string; tools?: unknown[] }>;
  }>("GET", "/agents/");

  const match = list.results?.find(
    (a) => a.name?.toLowerCase().includes("hands off") || a.name?.toLowerCase().includes("byoa"),
  );
  return match ? { id: match.id, connectUrl: match.connectUrl } : null;
}

async function main(): Promise<void> {
  console.log(`Webhook: ${WEBHOOK_URL}`);

  let agent = await findExistingByoa();

  if (!agent) {
    const created = await wassistRequest<{
      id: string;
      name?: string;
      connectUrl?: string;
    }>("POST", "/agents/byoa/", { webhookUrl: WEBHOOK_URL });
    agent = { id: created.id, connectUrl: created.connectUrl };
    console.log(`Created BYOA agent: ${created.name ?? created.id}`);
  } else {
    console.log(`Using existing agent: ${agent.id}`);
    await wassistRequest("PUT", `/agents/${agent.id}/`, {
      ...(await wassistRequest("GET", `/agents/${agent.id}/`)),
      webhookUrl: WEBHOOK_URL,
    }).catch(() => {
      console.log("(Could not PATCH webhook on existing agent — create fresh if needed)");
    });
  }

  updateEnvAgentId(agent.id);
  console.log(`Updated .env WASSIST_AGENT_ID=${agent.id}`);

  const details = await wassistRequest<{ connectUrl?: string; name?: string }>(
    "GET",
    `/agents/${agent.id}/`,
  );

  console.log(`\nAgent: ${details.name ?? agent.id}`);
  console.log(`Connect WhatsApp (open on your phone):`);
  console.log(details.connectUrl ?? agent.connectUrl ?? "—");
  console.log(`\nThen run: npm run send:demo`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
