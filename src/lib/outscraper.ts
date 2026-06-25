import { requireEnv } from "./env.js";

const OUTSCRAPER_BASE = "https://api.app.outscraper.com";

export interface OutscraperPlace {
  name: string;
  full_address?: string;
  phone?: string;
  site?: string;
  place_id?: string;
  type?: string;
  subtypes?: string;
}

export interface HuntResult {
  name: string;
  full_address: string;
  phone: string;
  google_place_id: string | null;
  niche: string | null;
}

export async function searchPlaces(
  query: string,
  limit = 20,
): Promise<OutscraperPlace[]> {
  const apiKey = requireEnv("OUTSCRAPER_API_KEY");
  const params = new URLSearchParams({
    query,
    limit: String(limit),
    async: "false",
    fields: "name,full_address,phone,site,place_id,type,subtypes",
  });

  const response = await fetch(
    `${OUTSCRAPER_BASE}/maps/search-v3?${params.toString()}`,
    {
      headers: { "X-API-KEY": apiKey },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Outscraper API error ${response.status}: ${body}`);
  }

  const json = (await response.json()) as {
    data?: OutscraperPlace[][];
  };

  const rows = json.data?.[0] ?? [];
  return rows;
}

export function filterNoWebsite(places: OutscraperPlace[]): OutscraperPlace[] {
  return places.filter((row) => {
    const hasSite = row.site && row.site.trim() !== "";
    const hasPhone = row.phone && row.phone.trim() !== "";
    return !hasSite && hasPhone;
  });
}

export function toHuntResult(place: OutscraperPlace): HuntResult {
  return {
    name: place.name,
    full_address: place.full_address ?? "",
    phone: place.phone!.trim(),
    google_place_id: place.place_id ?? null,
    niche: place.type ?? place.subtypes?.split(",")[0]?.trim() ?? null,
  };
}
