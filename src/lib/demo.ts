import { optionalEnv } from "./env.js";
import { upsertLead, getLeadsByStatus, normalizePhone, type Lead, type LeadStatus } from "./supabase.js";

export async function ensureDemoLead(): Promise<Lead | null> {
  const phone = optionalEnv("DEMO_PHONE");
  if (!phone) return null;

  const name = optionalEnv("DEMO_NAME") ?? "Ali's Hackathon Cafe";
  return upsertLead({
    name,
    phone,
    full_address: "Shoreditch, London, UK",
    niche: "cafe",
    status: "NEW",
  });
}

export function isDemoLead(lead: Lead): boolean {
  const phone = optionalEnv("DEMO_PHONE");
  if (!phone) return false;
  return normalizePhone(lead.phone) === normalizePhone(phone);
}

export async function getLeadsByStatusDemoFirst(
  status: LeadStatus,
  limit = 10,
): Promise<Lead[]> {
  const all = await getLeadsByStatus(status, 100);
  const demo = all.filter(isDemoLead);
  const rest = all.filter((l) => !isDemoLead(l));
  return [...demo, ...rest].slice(0, limit);
}
