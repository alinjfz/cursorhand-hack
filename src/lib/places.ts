import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export interface PlaceResult {
  name: string;
  full_address: string;
  phone: string;
  google_place_id: string | null;
  niche: string | null;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
}

const NICHE_KEYWORDS: Record<string, string[]> = {
  cafe: ["cafe", "coffee"],
  restaurant: ["restaurant", "food"],
  plumber: ["plumber", "plumbing"],
  electrician: ["electrician", "electrical"],
  salon: ["salon", "hairdresser", "barber"],
  shop: ["shop", "store", "retail"],
};

function nicheFromQuery(query: string): string {
  const lower = query.toLowerCase();
  for (const [niche, keywords] of Object.entries(NICHE_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return niche;
  }
  return "local business";
}

function overpassAmenityFilter(query: string): string {
  const lower = query.toLowerCase();
  if (lower.includes("cafe") || lower.includes("coffee")) return '["amenity"~"cafe|coffee_shop"]';
  if (lower.includes("plumber")) return '["craft"="plumber"]';
  if (lower.includes("restaurant") || lower.includes("food")) return '["amenity"~"restaurant|fast_food"]';
  if (lower.includes("salon") || lower.includes("barber")) return '["shop"~"hairdresser|beauty"]';
  if (lower.includes("electrician")) return '["craft"="electrician"]';
  return '["shop"]["name"]';
}

function buildAddress(tags: Record<string, string>): string {
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:city"] ?? "London",
    tags["addr:postcode"],
  ].filter(Boolean);
  return parts.join(", ") || tags["addr:full"] || "London, UK";
}

function getPhone(tags: Record<string, string>): string | null {
  const phone = tags.phone ?? tags["contact:phone"] ?? tags["contact:mobile"];
  return phone?.trim() || null;
}

function hasWebsite(tags: Record<string, string>): boolean {
  const site = tags.website ?? tags["contact:website"] ?? tags.url;
  return Boolean(site && site.trim() !== "");
}

function elementToPlace(el: OverpassElement, niche: string): PlaceResult | null {
  const tags = el.tags ?? {};
  const name = tags.name;
  if (!name) return null;

  const phone = getPhone(tags);
  if (!phone) return null;
  if (hasWebsite(tags)) return null;

  return {
    name,
    full_address: buildAddress(tags),
    phone,
    google_place_id: `osm/${el.type}/${el.id}`,
    niche: tags.amenity ?? tags.shop ?? tags.craft ?? niche,
  };
}

export async function searchPlacesOverpass(
  query: string,
  limit = 20,
): Promise<PlaceResult[]> {
  const niche = nicheFromQuery(query);
  const filter = overpassAmenityFilter(query);

  const overpassQuery = `
[out:json][timeout:30];
area["name"="Greater London"]["admin_level"="5"]->.london;
(
  node${filter}(area.london);
  way${filter}(area.london);
);
out tags ${limit};
`.trim();

  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(overpassQuery)}`,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Overpass API error ${response.status}: ${body}`);
  }

  const json = (await response.json()) as { elements: OverpassElement[] };
  const results: PlaceResult[] = [];

  for (const el of json.elements ?? []) {
    const place = elementToPlace(el, niche);
    if (place) results.push(place);
    if (results.length >= limit) break;
  }

  return results;
}

export function loadPlacesFromCsv(filePath: string): PlaceResult[] {
  const absolute = resolve(filePath);
  const content = readFileSync(absolute, "utf-8");
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const results: PlaceResult[] = [];

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const values = line.split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });

    if (!row.name || !row.phone) continue;
    if (row.site && row.site.trim() !== "") continue;

    results.push({
      name: row.name,
      full_address: row.full_address ?? row.address ?? "London, UK",
      phone: row.phone,
      google_place_id: row.google_place_id ?? row.place_id ?? null,
      niche: row.niche ?? row.type ?? null,
    });
  }

  return results;
}
