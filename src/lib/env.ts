import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../.env") });

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function optionalEnv(key: string): string | undefined {
  const value = process.env[key];
  return value && value.trim() !== "" ? value : undefined;
}

export function getSupabaseUrl(): string | undefined {
  return optionalEnv("SUPABASE_URL");
}

/** Service role / secret key for CLI writes. */
export function getSupabaseServiceKey(): string | undefined {
  return (
    optionalEnv("SUPABASE_SERVICE_ROLE_KEY") ??
    optionalEnv("SUPABASE_SECRET_KEY")
  );
}

export function getSupabaseAnonKey(): string | undefined {
  return (
    optionalEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ??
    optionalEnv("SUPABASE_ANON_KEY")
  );
}

export function hasSupabaseWriteAccess(): boolean {
  return Boolean(
    getSupabaseUrl() && (getSupabaseServiceKey() || getSupabaseAnonKey()),
  );
}

export function hasSupabaseReadAccess(): boolean {
  return Boolean(getSupabaseUrl() && (getSupabaseServiceKey() || getSupabaseAnonKey()));
}
