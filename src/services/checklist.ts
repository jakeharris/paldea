import type { DraftPokemon, ChecklistItem } from "./types";
import { getLearnable, generations } from "./pokemon-data";

// ── Sync checks ──

export function checkSpeed110(team: DraftPokemon[]): ChecklistItem {
  const contributors = team
    .filter((p) => p.baseStats.spe >= 110)
    .map((p) => p.name);
  return {
    id: "speed-110",
    label: "2+ base 110+ Speed",
    met: contributors.length >= 2,
    contributors,
  };
}

export function checkGroundImmunity(team: DraftPokemon[]): ChecklistItem {
  const immuneAbilities = new Set(["Levitate", "Earth Eater"]);
  const contributors = team
    .filter(
      (p) =>
        p.types.includes("Flying") ||
        immuneAbilities.has(p.abilities.primary) ||
        (p.abilities.secondary && immuneAbilities.has(p.abilities.secondary)) ||
        (p.abilities.hidden && immuneAbilities.has(p.abilities.hidden)),
    )
    .map((p) => p.name);
  return {
    id: "ground-immunity",
    label: "Ground immunity",
    met: contributors.length >= 1,
    contributors,
  };
}

export function checkElectricImmunity(team: DraftPokemon[]): ChecklistItem {
  const immuneAbilities = new Set([
    "Volt Absorb",
    "Lightning Rod",
    "Motor Drive",
  ]);
  const contributors = team
    .filter(
      (p) =>
        p.types.includes("Ground") ||
        immuneAbilities.has(p.abilities.primary) ||
        (p.abilities.secondary && immuneAbilities.has(p.abilities.secondary)) ||
        (p.abilities.hidden && immuneAbilities.has(p.abilities.hidden)),
    )
    .map((p) => p.name);
  return {
    id: "electric-immunity",
    label: "Electric immunity",
    met: contributors.length >= 1,
    contributors,
  };
}

export function checkTypeCore(team: DraftPokemon[]): ChecklistItem {
  const allTypes = new Set(team.flatMap((p) => [...p.types]));
  const fwg =
    allTypes.has("Fire") && allTypes.has("Water") && allTypes.has("Grass");
  const dsf =
    allTypes.has("Dragon") && allTypes.has("Steel") && allTypes.has("Fairy");

  const coreTypes = fwg
    ? ["Fire", "Water", "Grass"]
    : dsf
      ? ["Dragon", "Steel", "Fairy"]
      : [];
  const contributors =
    coreTypes.length > 0
      ? team
          .filter((p) => p.types.some((t) => coreTypes.includes(t)))
          .map((p) => p.name)
      : [];

  return {
    id: "type-core",
    label: "F/W/G or D/S/F core",
    met: fwg || dsf,
    contributors,
  };
}

export function checkSpinBlocker(team: DraftPokemon[]): ChecklistItem {
  const contributors = team
    .filter((p) => p.types.includes("Ghost"))
    .map((p) => p.name);
  return {
    id: "spin-blocker",
    label: "1 Spin-blocker (Ghost)",
    met: contributors.length >= 1,
    contributors,
  };
}

export function checkBulkyWater(team: DraftPokemon[]): ChecklistItem {
  const contributors = team
    .filter(
      (p) =>
        p.types.includes("Water") &&
        p.baseStats.hp + p.baseStats.def + p.baseStats.spd >= 260,
    )
    .map((p) => p.name);
  return {
    id: "bulky-water",
    label: "1 bulky Water",
    met: contributors.length >= 1,
    contributors,
  };
}

export function checkGroundedPoison(team: DraftPokemon[]): ChecklistItem {
  const contributors = team
    .filter(
      (p) =>
        p.types.includes("Poison") &&
        !p.types.includes("Flying") &&
        p.abilities.primary !== "Levitate" &&
        !(p.abilities.secondary && p.abilities.secondary === "Levitate") &&
        !(p.abilities.hidden && p.abilities.hidden === "Levitate"),
    )
    .map((p) => p.name);
  return {
    id: "grounded-poison",
    label: "1 grounded Poison (clears TSpikes)",
    met: contributors.length >= 1,
    contributors,
  };
}

// ── Async checks (need learnset data) ──

export const HAZARD_MOVES = ["Stealth Rock", "Spikes", "Toxic Spikes", "Sticky Web"];
export const CLEAR_MOVES = ["Rapid Spin", "Defog"];
export const PIVOT_MOVES = [
  "U-turn",
  "Volt Switch",
  "Flip Turn",
  "Teleport",
  "Parting Shot",
];
export const PRIORITY_MOVES = [
  "Aqua Jet",
  "Bullet Punch",
  "Extreme Speed",
  "Fake Out",
  "Ice Shard",
  "Mach Punch",
  "Quick Attack",
  "Shadow Sneak",
  "Sucker Punch",
  "Water Shuriken",
  "Accelerock",
  "Grassy Glide",
  "Jet Punch",
  "First Impression",
];

function toMoveId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function checkMoveList(
  team: DraftPokemon[],
  moves: string[],
  gen: number,
): Promise<string[]> {
  const genPrefix = String(gen);
  const moveIds = new Set(moves.map(toMoveId));
  const contributors: string[] = [];
  for (const p of team) {
    const learnable = await getLearnable(p.name, gen);
    if (!learnable) continue;
    const hasMove = Object.entries(learnable).some(
      ([id, methods]) =>
        moveIds.has(id) && methods.some((m) => m.startsWith(genPrefix)),
    );
    if (hasMove) contributors.push(p.name);
  }
  return contributors;
}

export async function checkHazardSetters(
  team: DraftPokemon[],
  gen: number = 9,
): Promise<ChecklistItem> {
  const contributors = await checkMoveList(team, HAZARD_MOVES, gen);
  return {
    id: "hazard-setters",
    label: "2+ Hazard setters",
    met: contributors.length >= 2,
    contributors,
  };
}

export async function checkHazardClearer(
  team: DraftPokemon[],
  gen: number = 9,
): Promise<ChecklistItem> {
  const contributors = await checkMoveList(team, CLEAR_MOVES, gen);
  return {
    id: "hazard-clearer",
    label: "1 Hazard clearer",
    met: contributors.length >= 1,
    contributors,
  };
}

export async function checkPivotUsers(
  team: DraftPokemon[],
  gen: number = 9,
): Promise<ChecklistItem> {
  const contributors = await checkMoveList(team, PIVOT_MOVES, gen);
  return {
    id: "pivot-users",
    label: "1+ Pivot moves",
    met: contributors.length >= 1,
    contributors,
  };
}

export async function checkSTABPriority(
  team: DraftPokemon[],
  gen: number = 9,
): Promise<ChecklistItem> {
  const genPrefix = String(gen);
  const generation = generations.get(gen);
  const contributors: string[] = [];

  for (const p of team) {
    const learnable = await getLearnable(p.name, gen);
    if (!learnable) continue;
    let hasStabPriority = false;
    for (const moveName of PRIORITY_MOVES) {
      const moveId = toMoveId(moveName);
      const methods = learnable[moveId];
      if (!methods?.some((m) => m.startsWith(genPrefix))) continue;
      const move = generation.moves.get(moveName);
      if (move && p.types.includes(move.type as string)) {
        hasStabPriority = true;
        break;
      }
    }
    if (hasStabPriority) contributors.push(p.name);
  }

  return {
    id: "stab-priority",
    label: "1+ STAB priority",
    met: contributors.length >= 1,
    contributors,
  };
}

export async function checkKnockOffUser(
  team: DraftPokemon[],
  gen: number = 9,
): Promise<ChecklistItem> {
  const contributors = await checkMoveList(team, ["Knock Off"], gen);
  return {
    id: "knock-off-user",
    label: "1+ Knock Off user",
    met: contributors.length >= 1,
    contributors,
  };
}

export async function checkFastDisruptor(
  team: DraftPokemon[],
  gen: number = 9,
): Promise<ChecklistItem> {
  const genPrefix = String(gen);
  const disruptMoveIds = new Set(["taunt", "encore"]);
  const contributors: string[] = [];

  for (const p of team) {
    if (p.baseStats.spe < 110) continue;
    const learnable = await getLearnable(p.name, gen);
    if (!learnable) continue;
    const hasMove = Object.entries(learnable).some(
      ([id, methods]) =>
        disruptMoveIds.has(id) && methods.some((m) => m.startsWith(genPrefix)),
    );
    if (hasMove) contributors.push(p.name);
  }

  return {
    id: "fast-disruptor",
    label: "1 fast Taunt/Encore (110+ Spe)",
    met: contributors.length >= 1,
    contributors,
  };
}

// ── Aggregate ──

/** Run all sync checks */
export function runSyncChecks(team: DraftPokemon[]): ChecklistItem[] {
  return [
    checkSpeed110(team),
    checkGroundImmunity(team),
    checkElectricImmunity(team),
    checkTypeCore(team),
    checkSpinBlocker(team),
    checkBulkyWater(team),
    checkGroundedPoison(team),
  ];
}

/** Run all async checks */
export async function runAsyncChecks(
  team: DraftPokemon[],
  gen: number = 9,
): Promise<ChecklistItem[]> {
  return Promise.all([
    checkHazardSetters(team, gen),
    checkHazardClearer(team, gen),
    checkPivotUsers(team, gen),
    checkSTABPriority(team, gen),
    checkKnockOffUser(team, gen),
    checkFastDisruptor(team, gen),
  ]);
}
