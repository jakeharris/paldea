# PALDEA

**Pokemon Assistant for League Draft Evaluation and Analysis**

Live: <https://paldea.jakeharris.dev>

---

## About

PALDEA is a web app for managing a Pokemon draft league. It covers the full workflow: building and tracking rosters across teams, validating team composition, and analyzing matchups against upcoming opponents.

The app is currently tailored to a specific draft league format but is designed to be extended to other formats over time.

## Features

### League & Team Management

- Create and configure leagues (generation, team size)
- Add and rename teams; flag your own team
- Search and draft Pokemon onto rosters
- Toggle Tera Captain status per Pokemon

### Side Panel Inspector

- Large sprite view with full base stat breakdown
- Smogon tier and usage data (fetched live)
- Team composition checklist (speed tiers, type immunities, hazard setters/clearers, pivot users, STAB priority, etc.)

### Matchup Analysis

- Select an opponent team and exclude individual Pokemon from analysis
- Defensive type chart — two per-team grids (rows = Pokémon, cols = 18 types) with a NET score row; NET cells have hover tooltips listing contributors by Critically Weak / Weak / Resistant / Deeply Resistant / Immune
- Coverage planner — select attacking types and see best multiplier per opponent Pokémon; team renders immediately (faded) before a type is selected
- Speed tier comparison — side-by-side sorted base speed lists plus a Speed Creep Calculator: choose your Pokémon, set scarf/stage for both sides (±6 stages), and see EVs needed to outspeed each opponent scenario (0 EV / 252 Neutral / 252 +Spe)
- Move category panel — browse learnable moves grouped by role (Priority, Pivots, Setup, Hazards, Hazard Removal, Healing, Status, Terrain/Weather/Screens); Gen 9 learnsets only

### Prep Wizard

The second tab on the Matchups page (`/matchups?view=prep`), using the same opponent and exclusions as the overview. Results come from real damage calcs (`@smogon/calc`) using each Pokémon's Smogon set.

- Offense Finder — the fewest attackers (2–4) on your roster whose learnsets OHKO the most of the opponent's team; each KO is checked against their Smogon set and/or a counter build (252 HP / 252+ in the defense the hit targets). Loadouts are ranked by how much coverage is left after losing any one member, and sets that reach the goal alone are listed separately as solo threats. Options: OHKO goal, roll threshold, premier moves only, Choice Band/Specs limit, weather, terrain, Stealth Rock. Each loadout can be copied as a Showdown import or opened in the Showdown damage calc
- Defense Finder — every opponent × your-Pokémon pairing calced both ways (their hardest hit, your hardest hit back, who moves first) and judged as a turn race: counters / checks / switch-in / loses. A threat grid shows their best matchups first (tap a cell for the calcs), and a defensive core picker (up to 3 of yours) shows what each core answers, with suggested best pairs. Options: Smogon set vs. max offense/bulk builds, learnset vs. Smogon set moves, roll assumptions, opponent Tera captains, weather, terrain
- Line Finder — listed in the tool switcher but not yet available

### PWA

- Installable, offline-capable
- Sprites and Smogon data cached aggressively for fast repeat loads

## Tech Stack

| Layer | Library |
|---|---|
| UI | React 19, Tailwind CSS 4 |
| Routing | React Router 7 |
| Build | Vite 6, TypeScript |
| Pokemon data | @pkmn/data, @pkmn/dex, @pkmn/smogon |
| PWA | vite-plugin-pwa (Workbox) |
| Testing | Vitest, Testing Library |

## Getting Started

```bash
npm install
npm run dev
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server (with Smogon API proxy) |
| `npm run build` | Type-check + production build |
| `npm run preview` | Preview production build locally |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
