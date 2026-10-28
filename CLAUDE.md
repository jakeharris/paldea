# CLAUDE.md

Context for Claude Code working in this repository.

## What This Is

PALDEA is a React PWA for managing a Pokemon draft league. It handles roster building across multiple teams, team composition validation, and matchup analysis (type charts, coverage, speed tiers, move categories). Currently tailored to one specific draft format but structured to generalize.

## Commands

```bash
npm run dev        # Vite dev server on :5173, proxies /api/smogon → smogon.com
npm run build      # tsc --noEmit + vite build
npm run preview    # Preview production build
npm run test       # Vitest watch mode
npm run test:run   # Single test run
```

## Architecture

### Routing — `src/router.tsx`
Three routes: `/` (HomePage), `/teams` (TeamsPage), `/matchups` (MatchupsPage). A `/draft` (Draft Board) route is planned but not yet implemented.

### State — `src/context/league-context.tsx`
Single centralized reducer managing all app state. Persisted to localStorage under key `"paldea-leagues"`. Three consumer hooks:
- `useLeagueState()` — full state snapshot
- `useLeagueDispatch()` — dispatch actions
- `useSelectedPokemon()` — derived selected Pokemon + team

State shape: `{ leagues, selectedLeagueId, selectedTeamId, selectedPokemonIndex }`. On load, sprite/icon URLs are re-derived (not trusted from storage).

### Services — `src/services/`
| File | Responsibility |
|---|---|
| `pokemon-data.ts` | Species lookup, stat/ability/type data, sprite URLs, learnset queries. All functions accept a `gen` param. Uses `@pkmn/generations`. |
| `matchup-calc.ts` | Defensive type chart, speed tier calculations, coverage analysis, move categorization. |
| `checklist.ts` | Sync and async team composition validators (speed, immunities, hazards, pivots, priority). |
| `type-utils.tsx` | `TYPE_COLORS` map + `TypeBadge` React component. |
| `smogon.ts` | Smogon `dump-pokemon` RPC: draft analysis + one standard set per mon (Draft → OU → National Dex → …), cached together. |
| `damage.ts` | Wrapper over `@smogon/calc` (attacker/defender builders, field setup, OHKO chance). |
| `offense-finder.ts` | Prep Wizard → Offense Finder search: fewest attackers (2+) whose learnsets OHKO the most opponents, ranked by coverage left after losing a member. KOs are checked against the opponent's Smogon set and a counter build (252 HP / 252+ in the hit defense). |
| `showdown-export.ts` | Showdown paste export + `calc.pokemonshowdown.com/?import=<base64>` links. |

### Pages — `src/pages/`
Route-level components. `TeamsPage` and `MatchupsPage` are the main feature pages; `HomePage` is a simple landing card.

### Components — `src/components/`
Organized by feature:
- `layout/` — `AppShell`, `Header`, `Nav`
- `ui/` — `Tooltip`
- `teams/` — `LeagueSection`, `TeamCard`, `PokemonRow`, `PokemonSearch`, `SidePanel`, `SidePanelSprite`, `SidePanelSmogon`, `SidePanelChecklist`
- `matchups/` — `MatchupHero`, `DefensiveTypeChart`, `CoveragePlanner`, `SpeedTierTool`, `MoveCategoryPanel`
- `prep/` — `PrepWizard` (tool switcher), `OffenseFinder`, `LoadoutCard`. Shown on `/matchups?view=prep`; the hero's exclusions apply to both views.

### Hooks — `src/hooks/`
- `use-pokemon-search.ts` — Debounced autocomplete, returns `{ query, results, search(), clear() }`
- `use-keyboard-search.ts` — Keyboard navigation for search results
- `use-team-checklist.ts` — Runs checklist validators on a team
- `use-matchup-moves.ts` — Async move categorization for two teams; cancel-safe via useEffect cleanup
- `use-offense-finder.ts` — Runs the Offense Finder search with progress; cancel-safe

## Key Conventions

- **Strict TypeScript** — no implicit any; all service functions are typed
- **Generation-aware** — pass `gen` (string like `"gen9"`) through data lookups
- **Async learnsets** — `@pkmn/data` learnsets are loaded lazily; hooks cancel in-flight work on unmount
- **Type badges** — always use `<TypeBadge type={...} />` from `src/services/type-utils.tsx`
- **Sprite URLs** — use `getSpriteUrl` / `getIconUrl` from `pokemon-data.ts`; never hardcode sprite paths
- **No direct localStorage access** — all persistence goes through the league context reducer

## Test Data

`src/fixtures/leagues.json` is real league data (WCPL Season 4, archived, and Season 5, whose Anisteria team has Chi-Yu) stored compactly as species names plus `teraCaptains`; `buildSeedLeagues()` in `src/fixtures/seed.ts` expands it via the dex. To seed a fresh browser (e.g. the preview pane), open any route with `?seed` in dev — e.g. `http://localhost:5173/matchups?seed` — which **replaces** stored leagues with the fixture. Dev-only; the fixture is tree-shaken out of production builds. Tests can import `buildSeedLeagues()` directly.

## Pokemon Data Libraries

`@pkmn/data` and `@pkmn/dex` provide generation-scoped species, moves, abilities, and learnsets. `@pkmn/smogon` provides tier and usage data (fetched via the Vite dev proxy in development). Access everything through the wrappers in `src/services/pokemon-data.ts` rather than calling `@pkmn` directly in components.

## Known Gotchas

### Learnset filtering must be gen-specific
`generation.learnsets.learnable(name)` accumulates moves across **all generations**, not just the target gen. Always filter to the target gen by checking learn method prefixes:

```ts
const genPrefix = String(gen); // e.g. "9" for Gen 9
const moveIds = Object.keys(learnable).filter(id =>
  learnable[id].some(method => method.startsWith(genPrefix))
);
```

This applies in both `matchup-calc.ts` (move categorization) and `checklist.ts` (role validators). The `canLearn()` helper from `@pkmn/data` is **not safe** for gen-specific checks — use `getLearnable()` + prefix filtering instead. Failing to do this causes false positives (e.g. Latias showing Defog, Gliscor showing as a hazard clearer) because of moves learned in earlier gens.

### Sprite/icon URLs
Icons use a two-tier strategy: `getIconUrl` returns `sprites/dex/{id}.png` (smaller files, primary), and components add an `onError` fallback to `getSpriteUrl` (`sprites/home/`) for Pokemon missing from `dex/`. `sprites/dex/` covers Gen 1–5 and many others but 404s on some Gen 8+ mons. `sprites/home/` covers all generations. `sprites/gen5/` only covers Gen 1–5.

`toShowdownId` mirrors Showdown's sprite IDs: base species ID, plus `-forme` for formes. Hyphens inside a base name are dropped and multi-word formes are squashed: `"Chi-Yu"` → `chiyu`, `"Ogerpon-Wellspring"` → `ogerpon-wellspring`, `"Urshifu-Rapid-Strike"` → `urshifu-rapidstrike`. A naive "keep every hyphen" ID 404s on these.

Image `onError` handlers must use `iconFallback(name)` / `retryWithBackoff(img)` from `pokemon-data.ts`. React's `onError` prop ignores `img.onerror = null`, so a handler that reassigns `src` to a URL that also 404s loops forever — hundreds of requests per broken sprite. `retryWithBackoff` retries on a Fibonacci schedule (1s…8s, 6 tries) and then stops.

### localStorage safety in `LeagueProvider`
The `useReducer` lazy initializer in `LeagueProvider` wraps the localStorage read in a `try/catch`. If **anything** inside the try throws, the catch returns `init` (empty state), and then `useEffect` immediately saves that empty state — wiping the user's data permanently.

Any secondary processing of the loaded data (e.g. refreshing derived fields) must be wrapped in a **nested** `try/catch` so the parsed leagues are still returned on failure:

```ts
try {
  const leagues = JSON.parse(stored);
  try {
    // refresh derived fields — failure here must not lose the data
    for (const mon of allMons(leagues)) {
      mon.icon = getIconUrl(mon.name);
    }
  } catch { /* proceed with stored values */ }
  return { ...init, leagues };
} catch { /* truly corrupt — fall through to empty init */ }
```

### `league-context.tsx` and Vite HMR
This file exports both a provider component and hook functions, which prevents Vite Fast Refresh. Changes to it trigger a full page remount (you'll see `"Could not Fast Refresh"` in the console). This is normal — the remount re-runs the `useReducer` initializer from localStorage and is safe as long as the localStorage safety rule above is followed.

### Smogon proxy in production
`services/smogon.ts` POSTs to `/api/smogon/dex/_rpc/dump-pokemon` (Smogon's own dex RPC, ~100 KB vs ~1 MB for the dex page) because smogon.com sends no CORS headers. In dev the Vite proxy handles it; on Vercel (paldea.jakeharris.dev) the rewrite in `vercel.json` does. Any new Smogon endpoint needs a matching rewrite there, or it 404s in production only. Results are persisted in the Cache API (`smogon-draft-analyses`, 7-day TTL for hits, 1 day for misses) — keep request volume to Smogon low.

### Damage calcs use `@smogon/calc/dist/adaptable`
Import calc classes from `@smogon/calc/dist/adaptable` (via `services/damage.ts`), never the package root — the root pulls in the calc's own bundled dex. The adaptable build runs on our `@pkmn/data` generations (cast to the calc's `Generation` interface). The calc doesn't model Sturdy/Disguise/Ice Face blocking an OHKO, so `runCalc` handles those itself.

### Showdown calc import links
calc.pokemonshowdown.com reads `?import=<base64>` into its Import box (the user still clicks Import). It decodes with `atob`, so pastes must be ASCII (`showdown-export.ts` strips accents). A `Nickname (Species)` header names the custom set; the nickname must not itself be a species name.

### Speed stage multipliers
The full ±6 range formula is: `stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage)`. A simple lookup table only covering 0–2 will produce wrong results for negative stages or stages above +2.

### `type-utils.tsx` must be `.tsx`
The file exports a `TypeBadge` JSX component. If named `.ts`, Vite/Babel will fail to compile it. Always keep the `.tsx` extension.

## PWA Caching

Configured in `vite.config.ts` via `vite-plugin-pwa`. Sprite URLs (Pokemon Showdown CDN) are cached 30 days; PokeAPI and Smogon data 7 days. Workbox cache size limit is 4 MB to accommodate `@pkmn` learnset data (~3 MB).
