import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseAnonKey,
  getSupabaseServiceKey,
  getSupabaseUrl,
  requireEnv,
} from "./env.js";

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

let writeClient: SupabaseClient | null = null;
let readClient: SupabaseClient | null = null;

function resolveWriteKey(): string {
  const service = getSupabaseServiceKey();
  if (service) return service;
  const anon = getSupabaseAnonKey();
  if (anon) return anon;
  throw new Error(
    "Set SUPABASE_SERVICE_ROLE_KEY (pipeline writes) or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  );
}

function resolveReadKey(): string {
  return getSupabaseServiceKey() ?? getSupabaseAnonKey() ?? resolveWriteKey();
}

/** CLI pipeline — prefers service role, falls back to publishable key. */
export function getSupabase(): SupabaseClient {
  if (!writeClient) {
    const url = getSupabaseUrl() ?? requireEnv("SUPABASE_URL");
    writeClient = createClient(url, resolveWriteKey());
  }
  return writeClient;
}

/** Dashboard / public reads — anon or service role. */
export function getSupabaseRead(): SupabaseClient {
  if (!readClient) {
    const url = getSupabaseUrl() ?? requireEnv("SUPABASE_URL");
    readClient = createClient(url, resolveReadKey());
  }
  return readClient;
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

export interface LeadStats {
  total: number;
  new: number;
  building: number;
  siteReady: number;
  contacted: number;
  interested: number;
  invoiced: number;
  paid: number;
  failed: number;
}

export async function getAllLeads(limit = 50): Promise<Lead[]> {
  const supabase = getSupabaseRead();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Supabase query failed: ${error.message}`);
  return (data ?? []) as Lead[];
}

export async function getLeadStats(): Promise<LeadStats> {
  const leads = await getAllLeads(500);
  const count = (status: LeadStatus) =>
    leads.filter((l) => l.status === status).length;

  return {
    total: leads.length,
    new: count("NEW"),
    building: count("BUILDING"),
    siteReady: count("SITE_READY"),
    contacted: count("CONTACTED"),
    interested: count("INTERESTED"),
    invoiced: count("INVOICED"),
    paid: count("PAID"),
    failed: count("FAILED"),
  };
}
