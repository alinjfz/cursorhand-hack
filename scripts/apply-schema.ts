#!/usr/bin/env tsx
/**
 * Apply supabase/schema.sql via direct Postgres connection.
 * Requires SUPABASE_DB_PASSWORD in .env (Supabase → Settings → Database).
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import "../src/lib/env.js";
import { optionalEnv, requireEnv } from "../src/lib/env.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA = resolve(__dirname, "../supabase/schema.sql");

function getConnectionString(): string {
  const direct = optionalEnv("DATABASE_URL");
  if (direct) return direct;

  const password = optionalEnv("SUPABASE_DB_PASSWORD");
  const url = requireEnv("SUPABASE_URL");
  const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (!ref || !password) {
    throw new Error(
      "Set SUPABASE_DB_PASSWORD or DATABASE_URL in .env\n" +
        "Get password from Supabase → Project Settings → Database",
    );
  }

  return `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-eu-west-2.pooler.supabase.com:6543/postgres`;
}

async function main(): Promise<void> {
  const sql = readFileSync(SCHEMA, "utf-8");
  const client = new pg.Client({ connectionString: getConnectionString() });

  console.log("Connecting to Supabase Postgres...");
  await client.connect();
  console.log("Applying schema...");
  await client.query(sql);
  await client.end();
  console.log("Schema applied successfully.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
