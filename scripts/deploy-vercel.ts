#!/usr/bin/env tsx
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import "../src/lib/env.js";
import { optionalEnv } from "../src/lib/env.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ENV_FILE = resolve(ROOT, ".env");

function parseEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    out[t.slice(0, i)] = t.slice(i + 1);
  }
  return out;
}

function setWebhookBaseUrl(url: string): void {
  const lines = readFileSync(ENV_FILE, "utf8").split("\n");
  const key = "WEBHOOK_BASE_URL";
  const row = `${key}=${url}`;
  const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
  if (idx >= 0) lines[idx] = row;
  else lines.push(row);
  writeFileSync(ENV_FILE, lines.join("\n").replace(/\n*$/, "\n"));
}

function main(): void {
  const env = parseEnv(ENV_FILE);
  const token = env.VERCEL_TOKEN ?? optionalEnv("VERCEL_TOKEN");
  if (!token) throw new Error("VERCEL_TOKEN missing");
  const scope = env.VERCEL_SCOPE ?? optionalEnv("VERCEL_SCOPE") ?? "alij-s-projects";

  execSync("npx tsx scripts/push-vercel-env.ts", {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });

  const out = execSync(
    `npx vercel deploy --prod --yes --token ${JSON.stringify(token)} --scope ${JSON.stringify(scope)}`,
    { cwd: ROOT, encoding: "utf8", env: process.env },
  );
  const match = out.match(/https:\/\/[^\s]+\.vercel\.app/);
  const url = match?.[0];
  if (!url) {
    console.log(out);
    throw new Error("Could not parse deployment URL from vercel output");
  }
  const base = url.replace(/\/$/, "");
  console.log("Deployed:", base);
  setWebhookBaseUrl(base);

  execSync("npx tsx scripts/push-vercel-env.ts", {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });
}

main();
