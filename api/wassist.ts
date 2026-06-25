import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  processPayday,
  type WassistWebhookPayload,
} from "../src/pipeline/payday.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const payload = req.body as WassistWebhookPayload;

    if (!payload.message || !payload.phone_number || !payload.reply_callback) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const result = await processPayday(payload);

    res.status(200).json({
      type: "message",
      content: result.content,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Webhook error:", message);
    res.status(500).json({
      type: "message",
      content: "Sorry, something went wrong. Please try again shortly.",
    });
  }
}
