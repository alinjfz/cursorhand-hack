import "../src/lib/env.js";
import { optionalEnv } from "../src/lib/env.js";
import { ensureDemoLead } from "../src/lib/demo.js";
import { updateLead } from "../src/lib/supabase.js";
import { createCheckoutOrder } from "../src/lib/paypal.js";
import { sendPaymentMessage } from "../src/lib/wassist.js";

async function main(): Promise<void> {
  const phone = optionalEnv("DEMO_PHONE");
  if (!phone) throw new Error("DEMO_PHONE not set");

  const lead = await ensureDemoLead();
  if (!lead?.id) throw new Error("Demo lead missing");

  console.log(`Sending PayPal link to ${phone}...`);
  const { orderId, checkoutUrl } = await createCheckoutOrder(lead.name);

  await updateLead(lead.id, {
    status: "INVOICED",
    paypal_order_id: orderId,
    paypal_checkout_url: checkoutUrl,
  });

  await sendPaymentMessage(phone, checkoutUrl);
  console.log(`✓ Sent: ${checkoutUrl}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
