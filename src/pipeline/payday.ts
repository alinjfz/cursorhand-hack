import {
  getLeadByPhone,
  updateLead,
  type Lead,
} from "../lib/supabase.js";
import { createCheckoutOrder } from "../lib/paypal.js";
import { replyViaCallback } from "../lib/wassist.js";

const YES_PATTERN = /\b(yes|yeah|yep|interested|sure|ok|okay)\b/i;

export interface WassistWebhookPayload {
  message: string;
  phone_number: string;
  reply_callback: string;
  image?: string | null;
}

export interface PaydayResult {
  content: string;
  processed: boolean;
}

export function isPositiveIntent(message: string): boolean {
  return YES_PATTERN.test(message.trim());
}

export async function processPayday(
  payload: WassistWebhookPayload,
): Promise<PaydayResult> {
  const { message, phone_number, reply_callback } = payload;

  console.log(`Inbound from ${phone_number}: "${message}"`);

  const lead = await findContactedLead(phone_number);
  if (!lead) {
    console.log(`No CONTACTED lead matched for ${phone_number}`);
    return {
      content:
        "Thanks for your message! We'll get back to you shortly.",
      processed: false,
    };
  }

  if (!isPositiveIntent(message)) {
    return {
      content:
        "Thanks for getting back to us! Reply YES if you'd like to claim your website.",
      processed: false,
    };
  }

  await updateLead(lead.id, {
    status: "INTERESTED",
    wassist_reply_callback: reply_callback,
  });

  const { orderId, checkoutUrl } = await createCheckoutOrder(lead.name);

  await updateLead(lead.id, {
    status: "INVOICED",
    paypal_order_id: orderId,
    paypal_checkout_url: checkoutUrl,
  });

  const paymentMessage = `Great! Claim your site here: ${checkoutUrl}`;
  await replyViaCallback(reply_callback, paymentMessage);

  console.log(`PayPal order ${orderId} sent to ${phone_number}`);

  return {
    content: "Perfect — sending your payment link now!",
    processed: true,
  };
}

async function findContactedLead(phone: string): Promise<Lead | null> {
  const lead = await getLeadByPhone(phone);
  if (lead && (lead.status === "CONTACTED" || lead.status === "INTERESTED")) {
    return lead;
  }
  return null;
}

export async function markLeadPaid(leadId: string): Promise<void> {
  await updateLead(leadId, { status: "PAID" });
}
