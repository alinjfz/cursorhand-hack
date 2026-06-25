import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "./env.js";

export type LeadStatus =
  | "NEW"
  | "BUILDING"
  | "SITE_READY"
  | "CONTACTED"
  | "INTERESTED"
  | "INVOICED"
  | "PAID"
  | "FAILED";

export interface Lead {
  id: string;
  name: string;
  full_address: string | null;
  phone: string;
  niche: string | null;
  google_place_id: string | null;
  status: LeadStatus;
  deployment_url: string | null;
  paypal_order_id: string | null;
  paypal_checkout_url: string | null;
  wassist_reply_callback: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );
  }
  return client;
}

export async function upsertLead(
  lead: Pick<Lead, "name" | "phone"> &
    Partial<
      Pick<
        Lead,
        | "full_address"
        | "niche"
        | "google_place_id"
        | "status"
        | "deployment_url"
        | "error_message"
      >
    >,
): Promise<Lead> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("leads")
    .upsert(
      {
        name: lead.name,
        phone: lead.phone,
        full_address: lead.full_address ?? null,
        niche: lead.niche ?? null,
        google_place_id: lead.google_place_id ?? null,
        status: lead.status ?? "NEW",
        deployment_url: lead.deployment_url ?? null,
        error_message: lead.error_message ?? null,
      },
      { onConflict: "phone" },
    )
    .select()
    .single();

  if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
  return data as Lead;
}

export async function getLeadsByStatus(
  status: LeadStatus,
  limit = 10,
): Promise<Lead[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`Supabase query failed: ${error.message}`);
  return (data ?? []) as Lead[];
}

export async function getLeadByPhone(phone: string): Promise<Lead | null> {
  const supabase = getSupabase();
  const variants = new Set([
    phone,
    normalizePhone(phone),
    phone.startsWith("+") ? phone.slice(1) : `+${phone}`,
  ]);

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .in("status", ["CONTACTED", "INTERESTED", "INVOICED"]);

  if (error) throw new Error(`Supabase query failed: ${error.message}`);

  const leads = (data ?? []) as Lead[];
  return (
    leads.find((lead) =>
      variants.has(lead.phone) || variants.has(normalizePhone(lead.phone)),
    ) ?? null
  );
}

export async function updateLead(
  id: string,
  updates: Partial<
    Pick<
      Lead,
      | "status"
      | "deployment_url"
      | "paypal_order_id"
      | "paypal_checkout_url"
      | "wassist_reply_callback"
      | "error_message"
    >
  >,
): Promise<Lead> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("leads")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Supabase update failed: ${error.message}`);
  return data as Lead;
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-()]/g, "");
}
