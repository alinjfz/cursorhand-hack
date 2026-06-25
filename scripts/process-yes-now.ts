import "../src/lib/env.js";
import { optionalEnv } from "../src/lib/env.js";
import { getLeadByPhone, updateLead } from "../src/lib/supabase.js";
import { createCheckoutOrder } from "../src/lib/paypal.js";
import { sendPaymentMessage } from "../src/lib/wassist.js";
import {
  findConversationForPhone,
  latestInboundYes,
} from "../src/lib/wassist-inbox.js";

const CONNECTED_AGENT_ID = "b8f4eda9-6bbe-43fc-870e-fa43ac19d4af";

async function main(): Promise<void> {
  const phone = optionalEnv("DEMO_PHONE");
  if (!phone) throw new Error("DEMO_PHONE not set");

  const lead = await getLeadByPhone(phone);
  if (!lead) throw new Error(`No lead for ${phone}`);
  if (lead.status === "INVOICED" || lead.status === "PAID") {
    if (lead.paypal_checkout_url) {
      await sendPaymentMessage(phone, lead.paypal_checkout_url);
      console.log(`✓ Re-sent existing link: ${lead.paypal_checkout_url}`);
      return;
    }
  }
  if (lead.status !== "CONTACTED" && lead.status !== "INTERESTED") {
    throw new Error(`Lead status is ${lead.status} — run npm run reset:demo first`);
  }

  const conversationId = await findConversationForPhone(CONNECTED_AGENT_ID, phone);
  if (!conversationId) {
    throw new Error(
      `No conversation found. Open https://wa.me/447424845871?text=/connect:${CONNECTED_AGENT_ID} on your phone.`,
    );
  }

  const yesText = await latestInboundYes(conversationId);
  if (!yesText) {
    console.log("No YES found yet. Reply YES on WhatsApp, then run: npm run process:yes");
    return;
  }

  console.log(`Found YES ("${yesText}") — creating PayPal order...`);
  await updateLead(lead.id, { status: "INTERESTED" });
  const { orderId, checkoutUrl } = await createCheckoutOrder(lead.name);
  await updateLead(lead.id, {
    status: "INVOICED",
    paypal_order_id: orderId,
    paypal_checkout_url: checkoutUrl,
  });

  await sendPaymentMessage(phone, checkoutUrl);
  console.log(`✓ PayPal link sent: ${checkoutUrl}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
