# Matchups Feature Implementation Plan

## Context

The app is a Pokemon draft league tool (React 19, TypeScript, Tailwind v4, @pkmn/dex+data). It currently has team management (`/teams`) but no matchup analysis. The Nav already links to `/matchups` but the route doesn't exist. This feature adds comprehensive team-vs-team analysis: defensive type charts, speed tier comparisons, move category breakdowns, and a coverage planner.

### Existing Architecture Summary

- **State management**: `src/context/league-context.tsx` — `useReducer` + localStorage (`paldea-leagues` key). State shape: `{ leagues: League[], selectedLeagueId, selectedTeamId, selectedPokemonIndex }`. Actions: HYDRATE, CREATE/DELETE/RENAME_LEAGUE, ADD/REMOVE_TEAM, ADD/REMOVE_POKEMON, TOGGLE_TERA_CAPTAIN, SELECT_POKEMON, CLEAR_SELECTION, SET_ACTIVE_TEAM.
- **Data models** (`src/services/types.ts`):
  - `DraftPokemon`: `{ id, name, types: [string] | [string, string], baseStats: { hp, atk, def, spa, spd, spe }, abilities: { primary, secondary, hidden }, sprite, icon, isTeraCaptain }`
  - `DraftTeam`: `{ id, playerName, pokemon: DraftPokemon[], isMyTeam }`
  - `League`: `{ id, name, generation, format, teamSize, teams: DraftTeam[] }`
- **Pokemon data** (`src/services/pokemon-data.ts`): Uses `@pkmn/dex` and `@pkmn/data`. Exports `generations` (Generations instance), `getSpecies`, `getLearnable`, `canLearn`, `getSpriteUrl`, `getAnimatedSpriteUrl`, `getIconUrl`, `toDraftPokemon`.
- **Type effectiveness**: `generations.get(gen).types.totalEffectiveness(attackType, defenderTypes)` returns multiplier (0, 0.25, 0.5, 1, 2, 4).
- **Move data**: `generations.get(gen).moves.get(name)` returns `{ priority, type, category, basePower, flags, status, boosts, heal, ... }`.
- **Nature data**: `generations.get(gen).natures.get(name)` returns `{ plus, minus }` for stat modifications.
- **Existing move lists** (`src/services/checklist.ts`, currently NOT exported):
  - `HAZARD_MOVES = ["Stealth Rock", "Spikes", "Toxic Spikes", "Sticky Web"]`
  - `CLEAR_MOVES = ["Rapid Spin", "Defog"]`
  - `PIVOT_MOVES = ["U-turn", "Volt Switch", "Flip Turn", "Teleport", "Parting Shot"]`
  - `PRIORITY_MOVES = ["Aqua Jet", "Bullet Punch", "Extreme Speed", "Fake Out", "Ice Shard", "Mach Punch", "Quick Attack", "Shadow Sneak", "Sucker Punch", "Water Shuriken", "Accelerock", "Grassy Glide", "Jet Punch", "First Impression"]`
- **UI patterns**: Custom glass card styling (`glass`, `glass-heavy`, `rounded-card`), type badge colors, stat coloring. Tailwind v4 with custom design tokens (`text-primary`, `text-secondary`, `text-muted`, `surface-raised`, `surface-overlay`, `accent`).
- **Shared components**: `src/components/ui/Tooltip.tsx`. `TYPE_COLORS` map and `TypeBadge` component exist in `PokemonSearch.tsx` (line 125-153) and are duplicated in `SidePanelSprite.tsx` — need to be extracted.
- **Hooks**: `use-pokemon-search.ts`, `use-keyboard-search.ts`, `use-team-checklist.ts` (pattern: sync checks via useMemo, async checks via useEffect with cancellation token).

## File Structure

### New Files
```
src/services/matchup-calc.ts              -- Pure calculation functions (type effectiveness, speed, coverage, move categorization)
src/services/type-utils.ts                -- Shared TYPE_COLORS map + TypeBadge component (extracted from PokemonSearch)
src/pages/MatchupsPage.tsx                -- Page container with opponent selection + section layout
src/components/matchups/MatchupHero.tsx   -- Hero element showing both teams with exclusion toggles
src/components/matchups/DefensiveTypeChart.tsx  -- Weakness/resistance table per type
src/components/matchups/SpeedTierTool.tsx       -- Speed tier comparison + EV calculator
src/components/matchups/MoveCategoryPanel.tsx   -- Move category listings for both teams
src/components/matchups/CoveragePlanner.tsx     -- Type selector + effectiveness grid
src/hooks/use-matchup-moves.ts            -- Async hook for move category data
```

### Modified Files
```
src/router.tsx                            -- Add /matchups route
src/services/checklist.ts                 -- Export HAZARD_MOVES, CLEAR_MOVES, PIVOT_MOVES, PRIORITY_MOVES
src/components/teams/PokemonSearch.tsx     -- Import TYPE_COLORS/TypeBadge from shared type-utils
src/components/teams/SidePanelSprite.tsx   -- Import TYPE_COLORS/TypeBadge from shared type-utils
```

## Implementation Phases

### Phase 1: Foundation

**1a. Extract shared type utilities** → `src/services/type-utils.ts`
- Move `TYPE_COLORS` map and `TypeBadge` component out of `PokemonSearch.tsx` (line 125-153) into a shared module
- Update imports in `PokemonSearch.tsx` and `SidePanelSprite.tsx`

**1b. Create `src/services/matchup-calc.ts`**

All pure functions, no React:

```ts
import { generations } from "./pokemon-data";
import type { DraftPokemon } from "./types";

export const ALL_TYPES = [
  "Normal","Fire","Water","Electric","Grass","Ice",
  "Fighting","Poison","Ground","Flying","Psychic","Bug",
  "Rock","Ghost","Dragon","Dark","Steel","Fairy"
] as const;

export type PokemonType = typeof ALL_TYPES[number];
```

Functions to implement:

- **`computeDefensiveChart(myTeam, oppTeam, gen)`** → For each of the 18 types as an attacker, compute weakness/resist/immune data for both teams. Returns per-type rows with counts AND contributing Pokemon names. Uses `generations.get(gen).types.totalEffectiveness(attackType, pokemon.types)`. Multiplier >= 2 is "weak", <= 0.5 is "resist", 0 is "immune".

  ```ts
  interface TypeMatchupDetail {
    count: number;
    pokemon: { name: string; icon: string; multiplier: number }[];
  }
  interface DefensiveChartRow {
    attackType: string;
    myWeak: TypeMatchupDetail;
    myResist: TypeMatchupDetail;
    myImmune: TypeMatchupDetail;
    oppWeak: TypeMatchupDetail;
    oppResist: TypeMatchupDetail;
    oppImmune: TypeMatchupDetail;
  }
  function computeDefensiveChart(myTeam: DraftPokemon[], oppTeam: DraftPokemon[], gen: number): DefensiveChartRow[]
  ```

- **`calcSpeed(baseSpe, ev, opts)`** → Level 100 speed formula:
  ```
  floor((floor((2 * base + 31 + floor(ev/4)) * 100/100 + 5)) * natureMultiplier) * scarfMultiplier * stageMultiplier
  ```
  - `natureMultiplier`: 1.1 for +speed, 1.0 for neutral
  - `scarfMultiplier`: 1.5 if scarf, 1.0 otherwise
  - `stageMultipliers`: [1, 1.5, 2] for stages 0/+1/+2
  - Each multiplication floors independently

  ```ts
  interface SpeedCalcOptions {
    plusNature: boolean;
    scarf: boolean;
    speedStage: number; // 0, 1, or 2
  }
  function calcSpeed(baseSpe: number, ev: number, opts: SpeedCalcOptions): number
  ```

- **`minEvsToOutspeed(baseSpe, targetSpeed, opts)`** → Iterate 0-252 by 4 to find minimum EVs that produce speed > targetSpeed. Return null if impossible even at 252.

  ```ts
  function minEvsToOutspeed(baseSpe: number, targetSpeed: number, opts: SpeedCalcOptions): number | null
  ```

- **`buildSpeedTiers(myTeam, oppTeam)`** → Sorted speed entries with pre-calculated benchmarks (0 EV neutral, 252 neutral, 252 +nature, 252 +nature scarf).

  ```ts
  interface SpeedTierEntry {
    pokemon: DraftPokemon;
    team: "mine" | "opponent";
    baseSpeed: number;
    speeds: { ev0: number; ev252Neutral: number; ev252Plus: number; ev252PlusScarf: number };
  }
  function buildSpeedTiers(myTeam: DraftPokemon[], oppTeam: DraftPokemon[]): SpeedTierEntry[]
  ```

- **`computeCoverage(selectedTypes, oppTeam, gen)`** → For each opponent Pokemon, check each selected type's effectiveness, return best multiplier and which types are super effective.

  ```ts
  interface CoverageResult {
    pokemon: DraftPokemon;
    bestMultiplier: number;
    effectiveTypes: string[]; // which selected types hit super-effective
  }
  function computeCoverage(selectedTypes: string[], oppTeam: DraftPokemon[], gen: number): CoverageResult[]
  ```

- **`categorizeTeamMoves(team, gen)`** → Async. For each Pokemon, call `getLearnable(name, gen)` (all in parallel via `Promise.all`), then for each Pokemon's learnable moveset, check against move lists and move properties.

  ```ts
  interface MoveCategoryResult {
    pokemonName: string;
    pokemonIcon: string;
    moves: string[];
  }
  interface AllMoveCategoryResults {
    priority: MoveCategoryResult[];
    pivot: MoveCategoryResult[];
    setup: MoveCategoryResult[];
    hazardSet: MoveCategoryResult[];
    hazardClear: MoveCategoryResult[];
    healing: MoveCategoryResult[];
    status: MoveCategoryResult[];
  }
  async function categorizeTeamMoves(team: DraftPokemon[], gen: number): Promise<AllMoveCategoryResults>
  ```

**1c. Export move constants** in `src/services/checklist.ts`
- Add `export` keyword to `HAZARD_MOVES`, `CLEAR_MOVES`, `PIVOT_MOVES`, `PRIORITY_MOVES`

**1d. Add route** in `src/router.tsx`
- Import `MatchupsPage`, add `{ path: "matchups", element: <MatchupsPage /> }`

**1e. Create `src/pages/MatchupsPage.tsx`**
- Read league context via `useLeagueState()` to find the selected league and the team marked `isMyTeam`
- Local state (useState):
  - `opponentTeamId: string | null`
  - `excludedMyIds: Set<number>` (indices into my team's pokemon array)
  - `excludedOppIds: Set<number>` (indices into opponent team's pokemon array)
  - `coverageTypes: Set<string>` (selected offensive types for coverage planner)
  - `speedOpts: { plusNature: boolean, scarf: boolean, speedStage: number }`
- Derived values (useMemo):
  - `myTeam` — the DraftTeam where `isMyTeam === true`
  - `oppTeam` — the team matching `opponentTeamId`
  - `activeMyPokemon` — `myTeam.pokemon` filtered by exclusion set
  - `activeOppPokemon` — `oppTeam.pokemon` filtered by exclusion set
- If no league or no isMyTeam found → show empty state with link to /teams
- Render: OpponentSelector dropdown (glass-styled `<select>`), then all sections when opponent is selected
- Reset exclusions when opponent changes

### Phase 2: Hero + Exclusions

**`src/components/matchups/MatchupHero.tsx`**
- Props: myTeam, oppTeam, excludedMyIds, excludedOppIds, onToggleMyExclusion, onToggleOppExclusion
- Dynamic hero with team player names displayed prominently, animated sprites, and "VS" divider
- Two team strips: my team (left) vs opponent (right)
- Each Pokemon shown as animated sprite (`getAnimatedSpriteUrl` with static `getSpriteUrl` fallback) with name underneath
- Checkbox overlay on each Pokemon for exclusion toggle
- Excluded Pokemon get `opacity-40 grayscale` CSS treatment + strikethrough on name
- Visual excitement: gradient backgrounds, large "VS" text, team names with gradient-accent styling

### Phase 3: Defensive Type Chart

**`src/components/matchups/DefensiveTypeChart.tsx`**
- Props: myTeam (active), oppTeam (active), gen
- HTML `<table>` with glass styling
- Rows: 18 offensive types (type badge using shared TypeBadge component in first column)
- Column groups: "Type" | "My Team Weak" | "My Team Resist" | "My Team Immune" | "Opp Weak" | "Opp Resist" | "Opp Immune"
- **Full detail always**: each cell shows the count AND small Pokemon icons for which mons contribute (e.g., "2 — [icon] Blastoise, [icon] Gyarados")
- Cell styling: weakness cells tinted red (`bg-red-500/10`), resist cells tinted green (`bg-green-500/10`), immune cells tinted purple (`bg-purple-500/10`)
- Only show rows where at least one team has a non-zero weakness, resist, or immunity (skip fully neutral rows)
- Fully synchronous — all data comes from DraftPokemon.types + `gen.types.totalEffectiveness()`
- Horizontally scrollable on narrow screens (`overflow-x-auto` wrapper)

### Phase 4: Speed Tier Tool

**`src/components/matchups/SpeedTierTool.tsx`** — Two-part layout:

**Part A: Unified Speed Tier List**
- All active Pokemon from both teams in one table, sorted by base speed descending
- Color-coded by team (e.g., accent/teal for mine, warm/orange for opponent)
- Columns: Icon + Name | Team | Base Spe | 0 EV | 252 Neutral | 252 +Spe | 252 +Spe Scarf
- Speed formula at **level 100**: `floor((floor((2*base + 31 + floor(ev/4)) * 100/100 + 5)) * nature) * scarf * stage`
- Quick visual of speed tier ordering — helps identify natural speed advantages

**Part B: Speed Creep Calculator**
- Pick one of my Pokemon from a dropdown or clickable list
- Shows a table: for each opponent mon, the EVs my selected mon needs to outspeed under various scenarios:
  - Columns: Opponent Mon | Their Base | To beat 0 EV | To beat 252 neutral | To beat 252 +Spe | To beat Scarf 252+ | To beat +1/+2 (if toggle is on)
  - Cells show the minimum EV investment needed (rounded up to nearest 4), or "Can't" if impossible even at 252 EVs
- Toggle options at top: checkboxes/buttons to assume opponent has +Speed nature, Choice Scarf, +1/+2 speed stages
- All synchronous math, no async needed

### Phase 5: Move Categories (Async)

**`src/hooks/use-matchup-moves.ts`**
- Follow the pattern from `src/hooks/use-team-checklist.ts`: useEffect with cancellation token
- Calls `categorizeTeamMoves()` for both teams in parallel via `Promise.all`
- Returns `{ myCategories: AllMoveCategoryResults | null, oppCategories: AllMoveCategoryResults | null, loading: boolean }`
- Stable cache key derived from pokemon names (joined string) to avoid redundant fetches when component re-renders

**Move category detection logic in `matchup-calc.ts`:**

For each Pokemon, call `getLearnable(name, gen)` which returns `Record<string, string[]> | undefined` (keys are move IDs). Then for each learnable move, use `gen.moves.get(moveName)` to get move properties and classify:

- **Priority**: Check if move name is in PRIORITY_MOVES list OR `move.priority > 0` (catches any we missed in the hardcoded list)
- **Pivot**: Check if move name is in PIVOT_MOVES list
- **Setup**: Check if `move.boosts` exists and has positive values for atk/def/spa/spd/spe (self-targeting boost moves like Swords Dance, Calm Mind, Dragon Dance, Nasty Plot, etc.)
- **Hazard set**: Check if move name is in HAZARD_MOVES list
- **Hazard clear**: Check if move name is in CLEAR_MOVES list
- **Healing**: Check `move.flags?.heal` is truthy, OR move name is in known list: Recover, Roost, Wish, Synthesis, Moonlight, Morning Sun, Slack Off, Soft-Boiled, Shore Up, Strength Sap, Rest
- **Status**: Check `move.status` field for values 'par', 'brn', 'slp', 'psn', 'tox', 'frz'

**`src/components/matchups/MoveCategoryPanel.tsx`**
- Props: myCategories, oppCategories, loading
- Two-column layout (my team | opponent team)
- 7 collapsible sections per column, one per category (Priority, Pivots, Setup, Hazards, Hazard Removal, Healing, Status)
- Each section header shows category name + count of Pokemon with access
- Under each section: list of Pokemon names (with icon) and their specific qualifying moves shown as small tags/chips
- Loading skeleton (`animate-pulse` pattern matching existing SidePanelChecklist) while async data loads

### Phase 6: Coverage Planner

**`src/components/matchups/CoveragePlanner.tsx`**
- Props: oppTeam (active), gen, coverageTypes (Set), onToggleCoverageType
- **Type selector**: horizontal row of 18 clickable type badges (using shared TypeBadge, but larger and toggleable). Selected types get bright ring/border (`ring-2 ring-white`), unselected are dimmed.
- **Results grid**: cards for each opponent Pokemon showing effectiveness from the selected type combination:
  - Each card: Pokemon icon + name + best multiplier badge
  - 4x → bright green with "4x" label, 2x → green "2x", 1x → gray "1x", 0.5x → orange "½x", 0.25x → deep orange "¼x", 0x → red "Immune"
  - Below the multiplier: list which selected type achieves the best hit
- Empty state when no types selected: "Select offensive types above to see coverage"
- Fully synchronous after type selection — uses `computeCoverage()` from matchup-calc

## Key Technical Decisions

- **State is page-local** (useState in MatchupsPage), NOT in league-context. Matchup analysis is session work, not persisted data. This keeps the global store lean.
- **Learnset performance**: Use `getLearnable()` once per Pokemon (returns full moveset dict), then filter synchronously. NOT `canLearn()` per move per Pokemon — that would be O(pokemon × moves) async calls.
- **TYPE_COLORS extracted** to `src/services/type-utils.ts` to avoid duplication across 4+ files.
- **Level 100** for all speed calculations (user preference for this draft league).
- **No new context providers**: MatchupsPage creates local state and passes slices down via props, matching the pattern used by TeamsPage.
- **Responsive**: Tables wrapped in `overflow-x-auto` for narrow screens. Hero uses flex-wrap.

## Component Tree

```
MatchupsPage (src/pages/MatchupsPage.tsx)
  ├── OpponentSelector (glass <select> dropdown)
  │
  └── (if opponent selected:)
      ├── MatchupHero (src/components/matchups/MatchupHero.tsx)
      │     ├── My Team Strip (sprites + exclusion checkboxes)
      │     ├── "VS" divider
      │     └── Opponent Team Strip (sprites + exclusion checkboxes)
      │
      ├── DefensiveTypeChart (src/components/matchups/DefensiveTypeChart.tsx)
      │     └── <table> with per-type rows and Pokemon detail cells
      │
      ├── SpeedTierTool (src/components/matchups/SpeedTierTool.tsx)
      │     ├── Speed Tier Table (all Pokemon sorted)
      │     └── Speed Creep Calculator (pick my mon, see EV targets)
      │
      ├── MoveCategoryPanel (src/components/matchups/MoveCategoryPanel.tsx)
      │     ├── My Team Categories (7 collapsible sections)
      │     └── Opponent Categories (7 collapsible sections)
      │
      └── CoveragePlanner (src/components/matchups/CoveragePlanner.tsx)
            ├── Type Selector (18 toggleable type badges)
            └── Results Grid (opponent Pokemon effectiveness cards)
```

## Verification

1. `npm run dev` → navigate to `/matchups`
2. Confirm opponent dropdown populates with all non-my-team teams from the selected league
3. Select an opponent → hero displays both teams with animated sprites
4. Toggle Pokemon exclusions → verify excluded mons are visually dimmed and removed from all analysis sections below
5. Defensive type chart → verify weakness/resist counts match manual calculation (e.g., pure Water type should show Electric 1 weakness, Grass 1 weakness, Fire/Water/Ice/Steel 1 resist each)
6. Speed tiers → verify speed values match Showdown damage calculator; toggle +nature/scarf and confirm recalculation
7. Speed creep → select a Pokemon, verify EV targets make sense (e.g., a faster mon should need 0 EVs to beat a slower mon's 0 EV speed)
8. Move categories → verify known moves appear (e.g., Blastoise should show Rapid Spin under hazard clearing, Recover under healing)
9. Coverage planner → select Fire+Electric types → verify super-effective/neutral/resist labels match the type chart
10. `npm run typecheck` and `npm test` pass
