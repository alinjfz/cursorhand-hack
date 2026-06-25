import {
  getWassistApiKey,
  getWassistOutboundSecret,
  hasWassistOutboundTemplates,
} from "./config.js";
import { normalizePhone } from "./supabase.js";
import { optionalEnv, requireEnv } from "./env.js";

const WASSIST_API_BASE = "https://backend.wassist.app/api/v1";
const WASSIST_OUTBOUND_BASE = "https://backend.wassist.app/chats/outbound";

export interface OutboundVariables {
  header?: string[];
  body: string[];
  buttons?: string[];
}

function apiHeaders(): Record<string, string> {
  const key = getWassistApiKey();
  if (!key) {
    throw new Error("WASSIST_API_KEY is not set");
  }
  return {
    "Content-Type": "application/json",
    "X-API-Key": key,
  };
}

async function wassistApiRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${WASSIST_API_BASE}${path}`, {
    method,
    headers: apiHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Wassist API error ${response.status}: ${text}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function sendOutboundTemplate(
  templateId: string,
  to: string,
  variables: OutboundVariables,
): Promise<void> {
  const secret = getWassistOutboundSecret();
  if (!secret) {
    throw new Error("Set WASSIST_OUTBOUND_SECRET or WASSIST_API_KEY");
  }

  const url = `${WASSIST_OUTBOUND_BASE}/${templateId}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-wassist-secret": secret,
    },
    body: JSON.stringify({ to, variables }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Wassist outbound error ${response.status}: ${body}`);
  }
}

function phonesMatch(a: string, b: string): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  return na === nb || na.endsWith(nb) || nb.endsWith(na);
}

async function findOrCreateConversation(phone: string): Promise<string> {
  const agentId = optionalEnv("WASSIST_AGENT_ID");
  if (!agentId) {
    throw new Error(
      "Set WASSIST_OUTBOUND_TEMPLATE_OUTREACH_ID or WASSIST_AGENT_ID",
    );
  }

  const list = await wassistApiRequest<{
    results?: Array<{ id: string; contact?: { phoneNumber?: string } }>;
  }>("GET", `/conversations/?agentId=${agentId}`);

  const existing = list.results?.find((c) =>
    c.contact?.phoneNumber ? phonesMatch(c.contact.phoneNumber, phone) : false,
  );
  if (existing) return existing.id;

  const created = await wassistApiRequest<{ id: string }>(
    "POST",
    "/conversations/",
    { agentId, toNumber: phone },
  );
  return created.id;
}

async function sendConversationMessage(
  conversationId: string,
  message: string,
): Promise<void> {
  await wassistApiRequest("POST", `/conversations/${conversationId}/messages/`, {
    type: "text",
    text: { body: message },
  });
}

export async function sendOutreachMessage(
  to: string,
  name: string,
  deploymentUrl: string,
): Promise<void> {
  const text = `Hi ${name}, I noticed you don't have a website. I built this for you: ${deploymentUrl}. Interested?`;

  if (hasWassistOutboundTemplates()) {
    const templateId = requireEnv("WASSIST_OUTBOUND_TEMPLATE_OUTREACH_ID");
    await sendOutboundTemplate(templateId, to, {
      body: [name, deploymentUrl],
    });
    return;
  }

  if (optionalEnv("WASSIST_AGENT_ID")) {
    const conversationId = await findOrCreateConversation(to);
    await sendConversationMessage(conversationId, text);
    return;
  }

  throw new Error(
    "Configure WASSIST_OUTBOUND_TEMPLATE_OUTREACH_ID (cold outreach) or WASSIST_AGENT_ID (session message)",
  );
}

export async function sendPaymentMessage(
  to: string,
  paypalLink: string,
): Promise<void> {
  const text = `Great! Claim your site here: ${paypalLink}`;

  const templateId = optionalEnv("WASSIST_OUTBOUND_TEMPLATE_PAYMENT_ID");
  if (templateId && getWassistOutboundSecret()) {
    await sendOutboundTemplate(templateId, to, { body: [paypalLink] });
    return;
  }

  if (optionalEnv("WASSIST_AGENT_ID")) {
    const conversationId = await findOrCreateConversation(to);
    await sendConversationMessage(conversationId, text);
    return;
  }

  throw new Error(
    "Configure WASSIST_OUTBOUND_TEMPLATE_PAYMENT_ID or WASSIST_AGENT_ID",
  );
}

export async function replyViaCallback(
  replyCallback: string,
  content: string,
): Promise<void> {
  const response = await fetch(replyCallback, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Wassist reply_callback error ${response.status}: ${body}`);
  }
}

export async function ensureByoaWebhook(webhookUrl: string): Promise<void> {
  const key = getWassistApiKey();
  if (!key) return;

  const response = await fetch("https://wassist.app/api/v1/agents/byoa/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": key,
    },
    body: JSON.stringify({ webhookUrl }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.warn(`BYOA webhook setup skipped: ${body}`);
  }
}
