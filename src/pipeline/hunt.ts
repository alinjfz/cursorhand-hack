import {
  searchPlaces,
  filterNoWebsite,
  toHuntResult,
} from "../lib/outscraper.js";
import { upsertLead, getLeadsByStatus } from "../lib/supabase.js";

export interface HuntOptions {
  query?: string;
  limit?: number;
  seed?: boolean;
}

const DEFAULT_QUERY = "cafes in Shoreditch, London, UK";

export async function runHunt(options: HuntOptions = {}): Promise<void> {
  const { query = DEFAULT_QUERY, limit = 20, seed = false } = options;

  if (seed) {
    const existing = await getLeadsByStatus("NEW", 10);
    console.log(`Seed mode: ${existing.length} pre-seeded NEW lead(s) ready`);
    for (const lead of existing) {
      console.log(`  • ${lead.name} (${lead.phone})`);
    }
    if (existing.length === 0) {
      console.log("No seeded leads found. Run supabase/schema.sql first.");
    }
    return;
  }

  console.log(`Hunting: "${query}" (limit ${limit})`);
  const places = await searchPlaces(query, limit);
  console.log(`Outscraper returned ${places.length} places`);

  const noWebsite = filterNoWebsite(places);
  console.log(`${noWebsite.length} places with no website + phone`);

  if (noWebsite.length === 0) {
    console.log("No leads found. Try a different query or use --seed.");
    return;
  }

  let upserted = 0;
  for (const place of noWebsite) {
    const result = toHuntResult(place);
    await upsertLead({
      name: result.name,
      phone: result.phone,
      full_address: result.full_address,
      niche: result.niche,
      google_place_id: result.google_place_id,
      status: "NEW",
    });
    console.log(`  ✓ ${result.name} — ${result.phone}`);
    upserted++;
  }

  console.log(`Hunt complete: ${upserted} lead(s) upserted`);
}
