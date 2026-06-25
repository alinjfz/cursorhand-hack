import {
  hasSupabaseReadAccess,
  hasSupabaseWriteAccess,
  optionalEnv,
} from "./env.js";

export type LlmProvider = "openrouter" | "anthropic" | "openai";
export type BuildProvider = "manus" | "llm-vercel";

export function getLlmProvider(): LlmProvider | null {
  if (optionalEnv("OPENROUTER_API_KEY")) return "openrouter";
  if (optionalEnv("ANTHROPIC_API_KEY")) return "anthropic";
  if (optionalEnv("OPENAI_API_KEY")) return "openai";
  return null;
}

export function requireLlmProvider(): LlmProvider {
  const provider = getLlmProvider();
  if (!provider) {
    throw new Error(
      "Set OPENROUTER_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY",
    );
  }
  return provider;
}

export function getBuildProvider(): BuildProvider {
  if (optionalEnv("MANUS_API_KEY")) return "manus";
  return "llm-vercel";
}

export function getWassistApiKey(): string | undefined {
  return optionalEnv("WASSIST_API_KEY");
}

export function getWassistOutboundSecret(): string | undefined {
  return optionalEnv("WASSIST_OUTBOUND_SECRET") ?? optionalEnv("WASSIST_API_KEY");
}

export function hasWassistOutboundTemplates(): boolean {
  return Boolean(
    optionalEnv("WASSIST_OUTBOUND_TEMPLATE_OUTREACH_ID") &&
      getWassistOutboundSecret(),
  );
}

export function getWassistMode(): "templates" | "agent" | "none" {
  if (hasWassistOutboundTemplates()) return "templates";
  if (optionalEnv("WASSIST_AGENT_ID")) return "agent";
  return "none";
}

export function describeConfiguredProviders(): string {
  const parts: string[] = [];
  const llm = getLlmProvider();
  if (llm) parts.push(`LLM: ${llm}`);
  parts.push(`Build: ${getBuildProvider()}`);
  if (hasSupabaseWriteAccess()) parts.push("Supabase: write");
  else if (hasSupabaseReadAccess()) parts.push("Supabase: read-only");
  else parts.push("Supabase: missing");
  if (optionalEnv("VERCEL_TOKEN")) parts.push("Vercel: ready");
  if (optionalEnv("PAYPAL_CLIENT_ID")) parts.push("PayPal: ready");
  if (getWassistApiKey()) {
    const mode = getWassistMode();
    parts.push(`Wassist: ${mode === "none" ? "needs agent/templates" : mode}`);
  }
  return parts.join(" | ");
}
