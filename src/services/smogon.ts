/** Smogon draft analysis service.
 *
 *  Fetches the Smogon dex page for each Pokemon and extracts the Draft
 *  strategy from the inline `dexSettings` JSON blob. A Vite dev-server
 *  proxy (`/api/smogon`) is used to avoid CORS issues.
 */

export interface DraftAnalysis {
  overview: string;      // HTML — call stripHtml() before rendering
  smogonUrl: string;     // deep-link to the Smogon dex draft page
}

const GEN_SLUGS: Record<number, string> = {
  1: "rb", 2: "gs", 3: "rs", 4: "dp", 5: "bw", 6: "xy", 7: "sm", 8: "ss", 9: "sv",
};

/** Turn a species name into the Smogon URL slug (e.g. "Iron Valiant" → "iron-valiant") */
function toSmogonSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

/** Build the public Smogon dex URL for a Pokemon's draft page */
export function getSmogonUrl(pokemonName: string, gen: number = 9): string {
  const slug = toSmogonSlug(pokemonName);
  const genSlug = GEN_SLUGS[gen] ?? "sv";
  return `https://www.smogon.com/dex/${genSlug}/pokemon/${slug}/draft/`;
}

/** Strip HTML tags from analysis text */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

/** Extract the first paragraph of actual overview text (skip Draft Order / Price Range) */
function extractSummary(overviewHtml: string): string {
  // The overview contains <p> blocks. The actual analysis starts after
  // the "Draft Order" and "Price Range" paragraphs.
  const paragraphs = overviewHtml
    .split(/<\/p>/i)
    .map((p) => p.replace(/<p>/gi, "").trim())
    .map(stripHtml)
    .filter(Boolean);

  // Skip paragraphs that start with "Draft Order" or "Price Range"
  const analysisParagraphs = paragraphs.filter(
    (p) => !p.startsWith("Draft Order") && !p.startsWith("Price Range"),
  );

  // Strip leading "Overview:" label if present
  const first = analysisParagraphs[0] ?? "";
  return first.replace(/^Overview:\s*/i, "");
}

const cache = new Map<string, DraftAnalysis | null>();

/**
 * Fetch draft analysis for a Pokemon from Smogon.
 * Returns a summary (first paragraph) and a link to the full page.
 */
export async function fetchDraftAnalysis(
  pokemonName: string,
  gen: number = 9,
): Promise<DraftAnalysis | null> {
  const key = `${gen}:${pokemonName}`;
  if (cache.has(key)) return cache.get(key)!;

  const smogonUrl = getSmogonUrl(pokemonName, gen);
  const slug = toSmogonSlug(pokemonName);
  const genSlug = GEN_SLUGS[gen] ?? "sv";

  try {
    // Fetch via the Vite proxy to avoid CORS
    const proxyUrl = `/api/smogon/dex/${genSlug}/pokemon/${slug}/draft/`;
    const resp = await fetch(proxyUrl);
    if (!resp.ok) {
      cache.set(key, null);
      return null;
    }

    const html = await resp.text();

    // Extract the dexSettings JSON blob from the page
    const match = html.match(/dexSettings\s*=\s*(\{.+\})\s*<\/script>/s);
    if (!match) {
      cache.set(key, null);
      return null;
    }

    const data = JSON.parse(match[1]);
    const rpcs = data.injectRpcs as [string, Record<string, unknown>][];

    // Find the dump-pokemon RPC which contains strategies
    let overview: string | null = null;
    for (const rpc of rpcs) {
      const rpcData = rpc[1] as { strategies?: { format: string; overview?: string }[] };
      if (!rpcData?.strategies) continue;

      for (const strategy of rpcData.strategies) {
        if (strategy.format?.toLowerCase() === "draft" && strategy.overview) {
          overview = strategy.overview;
          break;
        }
      }
      if (overview) break;
    }

    if (!overview) {
      cache.set(key, null);
      return null;
    }

    const result: DraftAnalysis = {
      overview: extractSummary(overview),
      smogonUrl,
    };

    cache.set(key, result);
    return result;
  } catch {
    cache.set(key, null);
    return null;
  }
}
