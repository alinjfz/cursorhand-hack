import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { requireEnv } from "./env.js";

export function writeSiteToTemp(leadId: string, html: string): string {
  const dir = join(tmpdir(), `site-${leadId}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html, "utf-8");
  return dir;
}

export function deployToVercel(siteDir: string): string {
  const token = requireEnv("VERCEL_TOKEN");

  const output = execSync(
    `npx vercel deploy --prod --yes --token "${token}"`,
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
