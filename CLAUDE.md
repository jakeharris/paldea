# CLAUDE.md

Context for Claude Code working in this repository.

## What This Is

PALDEA is a React PWA for managing a Pokemon draft league. It handles roster building across multiple teams, team composition validation, and matchup analysis (type charts, coverage, speed tiers, move categories). Currently tailored to one specific draft format but structured to generalize.

## Commands

```bash
npm run dev        # Vite dev server on :5173, proxies /smogon → Smogon API
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

### Pages — `src/pages/`
Route-level components. `TeamsPage` and `MatchupsPage` are the main feature pages; `HomePage` is a simple landing card.

### Components — `src/components/`
Organized by feature:
- `layout/` — `AppShell`, `Header`, `Nav`
- `ui/` — `Tooltip`
- `teams/` — `LeagueSection`, `TeamCard`, `PokemonRow`, `PokemonSearch`, `SidePanel`, `SidePanelSprite`, `SidePanelSmogon`, `SidePanelChecklist`
- `matchups/` — `MatchupHero`, `DefensiveTypeChart`, `CoveragePlanner`, `SpeedTierTool`, `MoveCategoryPanel`

### Hooks — `src/hooks/`
- `use-pokemon-search.ts` — Debounced autocomplete, returns `{ query, results, search(), clear() }`
- `use-keyboard-search.ts` — Keyboard navigation for search results
- `use-team-checklist.ts` — Runs checklist validators on a team
- `use-matchup-moves.ts` — Async move categorization for two teams; cancel-safe via useEffect cleanup

## Key Conventions

- **Strict TypeScript** — no implicit any; all service functions are typed
- **Generation-aware** — pass `gen` (string like `"gen9"`) through data lookups
- **Async learnsets** — `@pkmn/data` learnsets are loaded lazily; hooks cancel in-flight work on unmount
- **Type badges** — always use `<TypeBadge type={...} />` from `src/services/type-utils.tsx`
- **Sprite URLs** — use `getSpriteUrl` / `getAnimatedSpriteUrl` from `pokemon-data.ts`; never hardcode sprite paths
- **No direct localStorage access** — all persistence goes through the league context reducer

## Pokemon Data Libraries

`@pkmn/data` and `@pkmn/dex` provide generation-scoped species, moves, abilities, and learnsets. `@pkmn/smogon` provides tier and usage data (fetched via the Vite dev proxy in development). Access everything through the wrappers in `src/services/pokemon-data.ts` rather than calling `@pkmn` directly in components.

## PWA Caching

Configured in `vite.config.ts` via `vite-plugin-pwa`. Sprite URLs (Pokemon Showdown CDN) are cached 30 days; PokeAPI and Smogon data 7 days. Workbox cache size limit is 4 MB to accommodate `@pkmn` learnset data (~3 MB).
