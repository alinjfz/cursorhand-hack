import { requireEnv } from "./env.js";

const WASSIST_OUTBOUND_BASE = "https://backend.wassist.app/chats/outbound";

export interface OutboundVariables {
  header?: string[];
  body: string[];
  buttons?: string[];
}

export async function sendOutboundTemplate(
  templateId: string,
  to: string,
  variables: OutboundVariables,
): Promise<void> {
  const secret = requireEnv("WASSIST_OUTBOUND_SECRET");
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

export async function sendOutreachMessage(
  to: string,
  name: string,
  deploymentUrl: string,
): Promise<void> {
  const templateId = requireEnv("WASSIST_OUTBOUND_TEMPLATE_OUTREACH_ID");
  await sendOutboundTemplate(templateId, to, {
    body: [name, deploymentUrl],
  });
}

export async function sendPaymentMessage(
  to: string,
  paypalLink: string,
): Promise<void> {
  const templateId = requireEnv("WASSIST_OUTBOUND_TEMPLATE_PAYMENT_ID");
  await sendOutboundTemplate(templateId, to, {
    body: [paypalLink],
  });
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
