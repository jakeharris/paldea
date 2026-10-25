/** Smogon dex service.
 *
 *  Calls Smogon's `dump-pokemon` dex RPC (the same request smogon.com's dex
 *  page makes) and extracts the Draft analysis plus one standard set. The request goes through
 *  `/api/smogon` to avoid CORS: a Vite proxy in dev, and a `vercel.json`
 *  rewrite in production. Results are cached in memory and persisted via the
 *  Cache API.
 */

export interface DraftAnalysis {
  overview: string;      // HTML — call stripHtml() before rendering
  smogonUrl: string;     // deep-link to the Smogon dex draft page
}

/** One Smogon moveset, reduced to its first-listed option in each slot */
export interface SmogonSet {
  format: string;
  name: string;
  ability: string;
  item: string;
  nature: string;
  evs: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  teraType: string | null;
  moves: string[];
}

interface DexEntry {
  analysis: DraftAnalysis | null;
  standardSet: SmogonSet | null;
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

/** Singles formats whose sets are a fair "normal" build, most draft-like first */
const SET_FORMAT_PRIORITY = [
  "Draft", "OU", "National Dex", "Uber", "UU", "Ubers UU", "National Dex UU", "RU", "NU",
  "PU", "ZU", "National Dex Ubers", "Monotype", "National Dex Monotype",
  "Battle Stadium Singles", "1v1",
];

const cache = new Map<string, DexEntry | null>();

// ── Persistent cache ──
// Results are stored via the Cache API so a Pokemon isn't re-fetched from
// Smogon on every app load. Misses expire sooner in case an analysis is added.
const PERSIST_CACHE_NAME = "smogon-draft-analyses";
const HIT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 24 * 60 * 60 * 1000;

interface PersistedEntry extends DexEntry {
  fetchedAt: number;
}

function persistKey(genSlug: string, slug: string): string {
  return `/__smogon-cache/${genSlug}/${slug}`;
}

async function readPersisted(key: string): Promise<PersistedEntry | undefined> {
  if (typeof caches === "undefined") return undefined;
  try {
    const store = await caches.open(PERSIST_CACHE_NAME);
    const resp = await store.match(key);
    if (!resp) return undefined;
    const entry = (await resp.json()) as PersistedEntry;
    const ttl = entry.analysis || entry.standardSet ? HIT_TTL_MS : MISS_TTL_MS;
    // Entries written before sets were stored lack `standardSet` — refetch them
    if (!("standardSet" in entry) || Date.now() - entry.fetchedAt > ttl) {
      await store.delete(key);
      return undefined;
    }
    return entry;
  } catch {
    return undefined;
  }
}

async function writePersisted(key: string, dex: DexEntry): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const store = await caches.open(PERSIST_CACHE_NAME);
    const entry: PersistedEntry = { ...dex, fetchedAt: Date.now() };
    await store.put(
      key,
      new Response(JSON.stringify(entry), { headers: { "Content-Type": "application/json" } }),
    );
  } catch {
    /* persistence is best-effort */
  }
}

interface DumpMoveset {
  name: string;
  abilities?: string[];
  items?: string[];
  natures?: string[];
  teratypes?: string[];
  evconfigs?: SmogonSet["evs"][];
  moveslots?: { move: string }[][];
}

interface DumpPokemonResponse {
  strategies?: { format: string; overview?: string; movesets?: DumpMoveset[] }[];
}

/** First set from the highest-priority format that has one */
function pickStandardSet(data: DumpPokemonResponse): SmogonSet | null {
  const strategies = data.strategies ?? [];
  for (const format of SET_FORMAT_PRIORITY) {
    const strategy = strategies.find((s) => s.format === format && s.movesets?.length);
    const set = strategy?.movesets?.[0];
    if (!strategy || !set) continue;
    return {
      format,
      name: set.name,
      ability: set.abilities?.[0] ?? "",
      item: set.items?.[0] ?? "",
      nature: set.natures?.[0] ?? "Serious",
      evs: set.evconfigs?.[0] ?? { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      teraType: set.teratypes?.[0] ?? null,
      moves: (set.moveslots ?? []).map((slot) => slot[0]?.move).filter((m): m is string => !!m),
    };
  }
  return null;
}

async function fetchDexEntry(pokemonName: string, gen: number): Promise<DexEntry | null> {
  const key = `${gen}:${pokemonName}`;
  if (cache.has(key)) return cache.get(key)!;

  const smogonUrl = getSmogonUrl(pokemonName, gen);
  const slug = toSmogonSlug(pokemonName);
  const genSlug = GEN_SLUGS[gen] ?? "sv";
  const storeKey = persistKey(genSlug, slug);

  const persisted = await readPersisted(storeKey);
  if (persisted) {
    const entry = { analysis: persisted.analysis, standardSet: persisted.standardSet };
    cache.set(key, entry);
    return entry;
  }

  function remember(entry: DexEntry): DexEntry {
    cache.set(key, entry);
    void writePersisted(storeKey, entry);
    return entry;
  }

  try {
    // Smogon's own dex RPC (~100 KB) rather than the full dex page (~1 MB).
    // Proxied to avoid CORS — Vite in dev, vercel.json rewrite in production.
    const resp = await fetch("/api/smogon/dex/_rpc/dump-pokemon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gen: genSlug, alias: slug, language: "en" }),
    });
    // Non-OK may be transient (rate limit, outage) — don't cache, retry later
    if (!resp.ok) return null;

    // Unknown Pokemon come back as a 200 with a `null` body
    const data = (await resp.json()) as DumpPokemonResponse | null;
    if (!data) return remember({ analysis: null, standardSet: null });

    const draft = data.strategies?.find(
      (s) => s.format?.toLowerCase() === "draft" && s.overview,
    );
    return remember({
      analysis: draft?.overview ? { overview: extractSummary(draft.overview), smogonUrl } : null,
      standardSet: pickStandardSet(data),
    });
  } catch {
    // Network/parse failure — don't cache, so the next view retries
    return null;
  }
}

/**
 * Fetch draft analysis for a Pokemon from Smogon.
 * Returns a summary (first paragraph) and a link to the full page.
 */
export async function fetchDraftAnalysis(
  pokemonName: string,
  gen: number = 9,
): Promise<DraftAnalysis | null> {
  return (await fetchDexEntry(pokemonName, gen))?.analysis ?? null;
}

/**
 * Fetch the standard Smogon set for a Pokemon — the first set of the most
 * draft-like singles format that has one. Null if Smogon lists none.
 */
export async function fetchStandardSet(
  pokemonName: string,
  gen: number = 9,
): Promise<SmogonSet | null> {
  return (await fetchDexEntry(pokemonName, gen))?.standardSet ?? null;
}
