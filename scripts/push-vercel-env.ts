#!/usr/bin/env tsx
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync, spawnSync } from "node:child_process";
import "../src/lib/env.js";
import { optionalEnv } from "../src/lib/env.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ENV_FILE = resolve(ROOT, ".env");

const KEYS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "ANTHROPIC_API_KEY",
  "MANUS_API_KEY",
  "MANUS_AGENT_PROFILE",
  "VERCEL_TOKEN",
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "PAYPAL_MODE",
  "WASSIST_API_KEY",
  "WASSIST_AGENT_ID",
  "WASSIST_OUTBOUND_SECRET",
  "WASSIST_OUTBOUND_TEMPLATE_OUTREACH_ID",
  "WASSIST_OUTBOUND_TEMPLATE_PAYMENT_ID",
  "WEBHOOK_BASE_URL",
];

function parseEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    out[t.slice(0, i)] = t.slice(i + 1);
  }
  return out;
}

function vercelArgs(token: string, scope?: string): string[] {
  const args = ["vercel", "--token", token];
  if (scope) args.push("--scope", scope);
  return args;
}

function addEnv(
  key: string,
  value: string,
  token: string,
  scope?: string,
): void {
  const targets = ["production", "preview", "development"] as const;
  for (const env of targets) {
    const r = spawnSync(
      "npx",
      [...vercelArgs(token, scope), "env", "add", key, env, "--force"],
      {
        cwd: ROOT,
        input: value,
        encoding: "utf8",
        env: process.env,
      },
    );
    if (r.status !== 0) {
      console.warn(
        `vercel env add ${key} ${env}:`,
        (r.stderr || r.stdout).slice(0, 120),
      );
    } else {
      console.log(`Set ${key} (${env})`);
    }
  }
}

function main(): void {
  const env = parseEnv(ENV_FILE);
  const token = env.VERCEL_TOKEN ?? optionalEnv("VERCEL_TOKEN");
  if (!token) throw new Error("VERCEL_TOKEN missing in .env");
  const scope = env.VERCEL_SCOPE ?? optionalEnv("VERCEL_SCOPE") ?? "alij-s-projects";

  if (!existsSync(resolve(ROOT, ".vercel/project.json"))) {
    execSync(`npx ${vercelArgs(token, scope).join(" ")} link --yes`, {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
    });
  }

  for (const key of KEYS) {
    const value = env[key];
    if (!value || !value.trim()) continue;
    addEnv(key, value, token, scope);
  }
}

main();
