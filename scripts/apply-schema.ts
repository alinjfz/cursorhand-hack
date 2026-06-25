#!/usr/bin/env tsx
/**
 * Apply supabase/schema.sql via Postgres, Management API, or Supabase CLI (--linked).
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import pg from "pg";
import "../src/lib/env.js";
import { optionalEnv, requireEnv } from "../src/lib/env.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA = resolve(__dirname, "../supabase/schema.sql");
const ROOT = resolve(__dirname, "..");
const SUPABASE_BIN = resolve(ROOT, "node_modules/.bin/supabase");

function projectRef(): string {
  const url = requireEnv("SUPABASE_URL");
  const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (!ref) throw new Error("Invalid SUPABASE_URL");
  return ref;
}

function poolerHosts(): string[] {
  const override = optionalEnv("SUPABASE_DB_HOST");
  if (override) return [override];
  return [
    "aws-0-eu-west-1.pooler.supabase.com",
    "aws-0-eu-west-2.pooler.supabase.com",
    "aws-0-us-east-1.pooler.supabase.com",
  ];
}

function getConnectionStrings(): string[] {
  const direct = optionalEnv("DATABASE_URL");
  if (direct) return [direct];

  const password = optionalEnv("SUPABASE_DB_PASSWORD");
  if (!password) return [];

  const ref = projectRef();
  const enc = encodeURIComponent(password);
  const out: string[] = [];
  for (const host of poolerHosts()) {
    out.push(`postgresql://postgres.${ref}:${enc}@${host}:6543/postgres`);
    out.push(`postgresql://postgres.${ref}:${enc}@${host}:5432/postgres`);
    out.push(`postgresql://postgres:${enc}@${host}:6543/postgres`);
    out.push(`postgresql://postgres:${enc}@${host}:5432/postgres`);
  }
  out.push(
    `postgresql://postgres:${enc}@db.${projectRef()}.supabase.co:5432/postgres`,
  );
  return out;
}

async function applyViaPostgres(sql: string): Promise<boolean> {
  const strings = getConnectionStrings();
  if (strings.length === 0) return false;

  for (const connectionString of strings) {
    const client = new pg.Client({
      connectionString,
      connectionTimeoutMillis: 15000,
    });
    try {
      console.log(
        `Trying Postgres (${connectionString.replace(/:[^:@]+@/, ":***@")})...`,
      );
      await client.connect();
      await client.query(sql);
      await client.end();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  failed: ${msg.slice(0, 120)}`);
      try {
        await client.end();
      } catch {
        /* ignore */
      }
    }
  }
  return false;
}

function getAccessToken(): string | undefined {
  return (
    optionalEnv("SUPABASE_TOKEN") ??
    optionalEnv("SUPABASE_ACCESS_TOKEN") ??
    optionalEnv("SUPABASE_PERSONAL_ACCESS_TOKEN")
  );
}

async function applyViaManagementApi(sql: string): Promise<boolean> {
  const token = getAccessToken();
  if (!token) return false;

  const ref = projectRef();
  const url = `https://api.supabase.com/v1/projects/${ref}/database/query`;
  console.log("Trying Supabase Management API...");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.log(
      `  Management API failed ${response.status}: ${body.slice(0, 200)}`,
    );
    return false;
  }
  return true;
}

function applyViaSupabaseCli(): boolean {
  const token = getAccessToken();
  if (!token) return false;

  console.log("Trying Supabase CLI (db query --linked)...");
  const ref = projectRef();
  execSync(`${SUPABASE_BIN} login --token ${JSON.stringify(token)}`, {
    cwd: ROOT,
    stdio: "pipe",
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
  });
  execSync(`${SUPABASE_BIN} link --project-ref ${ref} --yes`, {
    cwd: ROOT,
    stdio: "pipe",
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
  });
  execSync(
    `${SUPABASE_BIN} db query --linked --yes -f ${JSON.stringify(SCHEMA)}`,
    {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
    },
  );
  return true;
}

async function main(): Promise<void> {
  const sql = readFileSync(SCHEMA, "utf-8");

  if (await applyViaManagementApi(sql)) {
    console.log("Schema applied successfully (Management API).");
    return;
  }

  try {
    if (applyViaSupabaseCli()) {
      console.log("Schema applied successfully (Supabase CLI).");
      return;
    }
  } catch (err) {
    console.log("CLI fallback failed:", err instanceof Error ? err.message : err);
  }

  if (await applyViaPostgres(sql)) {
    console.log("Schema applied successfully (Postgres).");
    return;
  }

  throw new Error(
    "Could not apply schema. Add one of:\n" +
      "  SUPABASE_DB_PASSWORD or DATABASE_URL (Supabase → Settings → Database)\n" +
      "  SUPABASE_TOKEN or SUPABASE_ACCESS_TOKEN (supabase.com/dashboard/account/tokens)",
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
