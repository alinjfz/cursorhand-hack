import { optionalEnv } from "./env.js";
import { normalizePhone } from "./supabase.js";
import { isPositiveIntent } from "../pipeline/payday.js";

const API_BASE = "https://backend.wassist.app/api/v1";

function apiKey(): string {
  const key = optionalEnv("WASSIST_API_KEY");
  if (!key) throw new Error("WASSIST_API_KEY is not set");
  return key;
}

interface WassistMessage {
  id: string;
  role?: string;
  text?: string | { body?: string };
  createdAt?: string;
}

function messageText(message: WassistMessage): string {
  if (typeof message.text === "string") return message.text;
  if (message.text && typeof message.text === "object") {
    return message.text.body ?? "";
  }
  return "";
}

function isInbound(message: WassistMessage): boolean {
  const role = (message.role ?? "").toLowerCase();
  return role === "user" || role === "customer" || role === "contact";
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "X-API-Key": apiKey() },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Wassist GET ${path} → ${response.status}: ${body.slice(0, 200)}`);
  }
  return response.json() as Promise<T>;
}

export async function findConversationForPhone(
  agentId: string,
  phone: string,
): Promise<string | null> {
  const list = await apiGet<{
    results?: Array<{ id: string; contact?: { phoneNumber?: string } }>;
  }>(`/conversations/?agentId=${agentId}`);

  const target = normalizePhone(phone);
  const match = list.results?.find((c) => {
    const p = c.contact?.phoneNumber;
    return p ? normalizePhone(p) === target || normalizePhone(p) === target.replace(/^\+/, "") : false;
  });
  return match?.id ?? null;
}

export async function listConversationMessages(
  conversationId: string,
  limit = 30,
): Promise<WassistMessage[]> {
  const data = await apiGet<{ results?: WassistMessage[] } | WassistMessage[]>(
    `/conversations/${conversationId}/messages/?limit=${limit}`,
  );
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

export async function latestInboundYes(
  conversationId: string,
  afterIso?: string,
): Promise<string | null> {
  const messages = await listConversationMessages(conversationId);
  const inbound = messages.filter(isInbound);
  // API returns newest messages first — pick the latest YES still in the window.
  for (const message of inbound) {
    if (afterIso && message.createdAt && message.createdAt < afterIso) continue;
    const text = messageText(message);
    if (text && isPositiveIntent(text)) return text;
  }
  return null;
}

export async function waitForInboundYes(
  agentId: string,
  phone: string,
  options: { timeoutMs?: number; pollMs?: number } = {},
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const pollMs = options.pollMs ?? 3_000;
  const started = Date.now();
  const notBefore = new Date().toISOString();

  while (Date.now() - started < timeoutMs) {
    const conversationId = await findConversationForPhone(agentId, phone);
    if (conversationId) {
      const yes = await latestInboundYes(conversationId, notBefore);
      if (yes) return yes;
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }

  throw new Error("Timed out waiting for YES reply on WhatsApp");
}
