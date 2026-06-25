#!/usr/bin/env tsx
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import "../src/lib/env.js";
import { optionalEnv } from "../src/lib/env.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ENV_FILE = resolve(ROOT, ".env");

async function main(): Promise<void> {
  const token = optionalEnv("VERCEL_TOKEN");
  if (!token) throw new Error("VERCEL_TOKEN missing");

  execSync(`npx vercel link --yes --token ${JSON.stringify(token)}`, {
    cwd: ROOT,
    stdio: "inherit",
  });

  const output = execSync(
    `npx vercel deploy --prod --yes --token ${JSON.stringify(token)}`,
    { cwd: ROOT, encoding: "utf8" },
  );

  const url = output.match(/https:\/\/[^\s]+\.vercel\.app/)?.[0];
  if (!url) {
    console.log(output);
    throw new Error("Could not parse deployment URL");
  }

  console.log(`Deployed: ${url}`);

  let envContent = readFileSync(ENV_FILE, "utf8");
  const stable =
    url.includes("website-found") && !url.endsWith("website-found.vercel.app")
      ? "https://website-found.vercel.app"
      : url.replace(/-[a-z0-9]+-alij-s-projects\.vercel\.app$/, ".vercel.app");
  if (/^WEBHOOK_BASE_URL=.*$/m.test(envContent)) {
    envContent = envContent.replace(
      /^WEBHOOK_BASE_URL=.*$/m,
      `WEBHOOK_BASE_URL=${stable}`,
    );
  } else {
    envContent += `\nWEBHOOK_BASE_URL=${stable}\n`;
  }
  writeFileSync(ENV_FILE, envContent);
  console.log(`Updated WEBHOOK_BASE_URL in .env`);
}

main();
