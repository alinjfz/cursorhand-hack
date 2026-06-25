import { searchPlacesOverpass, loadPlacesFromCsv } from "../lib/places.js";
import { upsertLead, getLeadsByStatus } from "../lib/supabase.js";

export interface HuntOptions {
  query?: string;
  limit?: number;
  seed?: boolean;
  source?: "overpass" | "csv";
  csv?: string;
}

const DEFAULT_QUERY = "cafes in Shoreditch, London, UK";
const DEFAULT_CSV = "mydocs/leads.csv";

export async function runHunt(options: HuntOptions = {}): Promise<void> {
  const {
    query = DEFAULT_QUERY,
    limit = 20,
    seed = false,
    source = "overpass",
    csv = DEFAULT_CSV,
  } = options;

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

  let places;
  if (source === "csv") {
    console.log(`Hunting from CSV: ${csv}`);
    places = loadPlacesFromCsv(csv);
    console.log(`CSV returned ${places.length} leads (no website + phone)`);
  } else {
    console.log(`Hunting via OpenStreetMap: "${query}" (limit ${limit})`);
    places = await searchPlacesOverpass(query, limit);
    console.log(`Overpass returned ${places.length} places with phone, no website`);
  }

  if (places.length === 0) {
    console.log("No leads found. Try --source csv or use --seed.");
    return;
  }

  let upserted = 0;
  for (const place of places) {
    await upsertLead({
      name: place.name,
      phone: place.phone,
      full_address: place.full_address,
      niche: place.niche,
      google_place_id: place.google_place_id,
      status: "NEW",
    });
    console.log(`  ✓ ${place.name} — ${place.phone}`);
    upserted++;
  }

  console.log(`Hunt complete: ${upserted} lead(s) upserted`);
}
