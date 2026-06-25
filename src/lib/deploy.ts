import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { requireEnv, optionalEnv } from "./env.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const SITES_DIR = resolve(ROOT, "public/sites");

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function writeSiteToTemp(leadId: string, html: string): string {
  const dir = join(tmpdir(), `site-${leadId}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html, "utf-8");
  return dir;
}

export function writeSiteToPublic(name: string, html: string): string {
  const slug = slugify(name);
  const dir = join(SITES_DIR, slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html, "utf-8");
  return slug;
}

export function sitePublicUrl(slug: string): string {
  const base = optionalEnv("WEBHOOK_BASE_URL") ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/sites/${slug}/`;
}

export function redeployMainProject(): void {
  const token = requireEnv("VERCEL_TOKEN");
  const vercelBin = resolve(ROOT, "node_modules/.bin/vercel");
  execSync(`${vercelBin} deploy --prod --yes --token ${JSON.stringify(token)}`, {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, VERCEL_TOKEN: token },
  });
}

export function deployToVercel(siteDir: string): string {
  const token = requireEnv("VERCEL_TOKEN");
  const vercelBin = resolve(ROOT, "node_modules/.bin/vercel");

  const output = execSync(
    `${vercelBin} deploy --prod --yes --token ${JSON.stringify(token)}`,
    {
      cwd: siteDir,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, VERCEL_TOKEN: token },
    },
  );

  const urlMatch = output.match(/https:\/\/[^\s]+\.vercel\.app/);
  if (!urlMatch) {
    throw new Error(`Could not parse deployment URL from Vercel output:\n${output}`);
  }

  return urlMatch[0];
}

export function deploySiteInProject(name: string, html: string): string {
  const slug = writeSiteToPublic(name, html);
  console.log("Redeploying main project with new site...");
  redeployMainProject();
  return sitePublicUrl(slug);
}
