import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getLeadsByStatus, updateLead } from "../../src/lib/supabase.js";
import { captureOrder } from "../../src/lib/paypal.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const token = req.query.token as string | undefined;

  if (!token) {
    res.status(400).send("Missing order token");
    return;
  }

  try {
    const success = await captureOrder(token);
    if (success) {
      const invoiced = await getLeadsByStatus("INVOICED", 100);
      const lead = invoiced.find((l) => l.paypal_order_id === token);
      if (lead) {
        await updateLead(lead.id, { status: "PAID" });
      }
    }

    res.status(200).send(
      success
        ? "<h1>Payment successful!</h1><p>Your website is on its way.</p>"
        : "<h1>Payment processing</h1><p>We'll confirm shortly.</p>",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("PayPal success handler error:", message);
    res.status(500).send("Payment processing error");
  }
}
