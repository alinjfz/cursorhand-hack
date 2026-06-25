import type { VercelRequest, VercelResponse } from "@vercel/node";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    res.status(200).json({
      configured: false,
      leads: [],
      stats: null,
      message:
        "Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or publishable key) to enable the live dashboard.",
    });
    return;
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, key);

    const { data, error } = await supabase
      .from("leads")
      .select(
        "id, name, full_address, phone, niche, status, deployment_url, paypal_checkout_url, error_message, created_at, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      res.status(500).json({
        configured: true,
        leads: [],
        stats: null,
        message: error.message,
      });
      return;
    }

    const leads = data ?? [];
    const count = (status: string) =>
      leads.filter((l) => l.status === status).length;

    res.status(200).json({
      configured: true,
      leads,
      stats: {
        total: leads.length,
        new: count("NEW"),
        building: count("BUILDING"),
        siteReady: count("SITE_READY"),
        contacted: count("CONTACTED"),
        interested: count("INTERESTED"),
        invoiced: count("INVOICED"),
        paid: count("PAID"),
        failed: count("FAILED"),
        sitesBuilt: count("SITE_READY") + count("CONTACTED") + count("INTERESTED") + count("INVOICED") + count("PAID"),
        outreachSent: count("CONTACTED") + count("INTERESTED") + count("INVOICED") + count("PAID"),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ configured: true, leads: [], stats: null, message });
  }
}
