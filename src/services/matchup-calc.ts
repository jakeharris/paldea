import { generations, getLearnable } from "./pokemon-data";
import type { DraftPokemon } from "./types";
import { HAZARD_MOVES, CLEAR_MOVES, PIVOT_MOVES, PRIORITY_MOVES } from "./checklist";

export const ALL_TYPES = [
  "Normal", "Fire", "Water", "Electric", "Grass", "Ice",
  "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug",
  "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy",
] as const;

export type PokemonType = typeof ALL_TYPES[number];

// ── Defensive Type Chart ──

export interface TypeMatchupDetail {
  count: number;
  pokemon: { name: string; icon: string; multiplier: number }[];
}

export interface DefensiveChartRow {
  attackType: string;
  myWeak: TypeMatchupDetail;
  myResist: TypeMatchupDetail;
  myImmune: TypeMatchupDetail;
  oppWeak: TypeMatchupDetail;
  oppResist: TypeMatchupDetail;
  oppImmune: TypeMatchupDetail;
}

function classifyTeam(
  team: DraftPokemon[],
  attackType: string,
  gen: number,
): { weak: TypeMatchupDetail; resist: TypeMatchupDetail; immune: TypeMatchupDetail } {
  const generation = generations.get(gen);
  const weak: TypeMatchupDetail = { count: 0, pokemon: [] };
  const resist: TypeMatchupDetail = { count: 0, pokemon: [] };
  const immune: TypeMatchupDetail = { count: 0, pokemon: [] };

  for (const p of team) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mult = generation.types.totalEffectiveness(attackType as any, p.types as any);
    if (mult === 0) {
      immune.count++;
      immune.pokemon.push({ name: p.name, icon: p.icon, multiplier: 0 });
    } else if (mult >= 2) {
      weak.count++;
      weak.pokemon.push({ name: p.name, icon: p.icon, multiplier: mult });
    } else if (mult <= 0.5) {
      resist.count++;
      resist.pokemon.push({ name: p.name, icon: p.icon, multiplier: mult });
    }
  }

  return { weak, resist, immune };
}

export function computeDefensiveChart(
  myTeam: DraftPokemon[],
  oppTeam: DraftPokemon[],
  gen: number,
): DefensiveChartRow[] {
  const rows: DefensiveChartRow[] = [];

  for (const attackType of ALL_TYPES) {
    const my = classifyTeam(myTeam, attackType, gen);
    const opp = classifyTeam(oppTeam, attackType, gen);

    const hasAny =
      my.weak.count > 0 || my.resist.count > 0 || my.immune.count > 0 ||
      opp.weak.count > 0 || opp.resist.count > 0 || opp.immune.count > 0;

    if (!hasAny) continue;

    rows.push({
      attackType,
      myWeak: my.weak,
      myResist: my.resist,
      myImmune: my.immune,
      oppWeak: opp.weak,
      oppResist: opp.resist,
      oppImmune: opp.immune,
    });
  }

  return rows;
}

// ── Speed Calculations ──

export interface SpeedCalcOptions {
  plusNature: boolean;
  scarf: boolean;
  speedStage: number; // -6 to +6
}

function stageMultiplier(stage: number): number {
  const s = Math.max(-6, Math.min(6, stage));
  return s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
}

export function calcSpeed(baseSpe: number, ev: number, opts: SpeedCalcOptions): number {
  const natureMultiplier = opts.plusNature ? 1.1 : 1.0;
  const scarfMultiplier = opts.scarf ? 1.5 : 1.0;
  const stageMultiplier_ = stageMultiplier(opts.speedStage);

  const base = Math.floor(
    Math.floor((2 * baseSpe + 31 + Math.floor(ev / 4)) * 100 / 100 + 5) * natureMultiplier
  );
  const scarf = Math.floor(base * scarfMultiplier);
  return Math.floor(scarf * stageMultiplier_);
}

export function minEvsToOutspeed(
  baseSpe: number,
  targetSpeed: number,
  opts: SpeedCalcOptions,
): number | null {
  for (let ev = 0; ev <= 252; ev += 4) {
    if (calcSpeed(baseSpe, ev, opts) > targetSpeed) return ev;
  }
  // Check 252 exactly (loop steps by 4, 252 % 4 === 0 so it's included)
  return null;
}

export interface SpeedTierEntry {
  pokemon: DraftPokemon;
  team: "mine" | "opponent";
  baseSpeed: number;
  speeds: {
    ev0: number;
    ev252Neutral: number;
    ev252Plus: number;
    ev252PlusScarf: number;
  };
}

export function buildSpeedTiers(
  myTeam: DraftPokemon[],
  oppTeam: DraftPokemon[],
): SpeedTierEntry[] {
  const entries: SpeedTierEntry[] = [];

  function addTeam(team: DraftPokemon[], side: "mine" | "opponent") {
    for (const p of team) {
      const base = p.baseStats.spe;
      entries.push({
        pokemon: p,
        team: side,
        baseSpeed: base,
        speeds: {
          ev0: calcSpeed(base, 0, { plusNature: false, scarf: false, speedStage: 0 }),
          ev252Neutral: calcSpeed(base, 252, { plusNature: false, scarf: false, speedStage: 0 }),
          ev252Plus: calcSpeed(base, 252, { plusNature: true, scarf: false, speedStage: 0 }),
          ev252PlusScarf: calcSpeed(base, 252, { plusNature: true, scarf: true, speedStage: 0 }),
        },
      });
    }
  }

  addTeam(myTeam, "mine");
  addTeam(oppTeam, "opponent");

  return entries.sort((a, b) => b.baseSpeed - a.baseSpeed);
}

// ── Coverage Planner ──

export interface CoverageResult {
  pokemon: DraftPokemon;
  bestMultiplier: number;
  effectiveTypes: string[]; // which selected types hit super-effective
}

export function computeCoverage(
  selectedTypes: string[],
  oppTeam: DraftPokemon[],
  gen: number,
): CoverageResult[] {
  const generation = generations.get(gen);

  return oppTeam.map((p) => {
    let bestMultiplier = 0;
    const effectiveTypes: string[] = [];

    for (const attackType of selectedTypes) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mult = generation.types.totalEffectiveness(attackType as any, p.types as any);
      if (mult > bestMultiplier) bestMultiplier = mult;
      if (mult >= 2) effectiveTypes.push(attackType);
    }

    return { pokemon: p, bestMultiplier, effectiveTypes };
  });
}

// ── Move Categorization ──

export interface MoveCategoryResult {
  pokemonName: string;
  pokemonIcon: string;
  moves: string[];
}

export interface AllMoveCategoryResults {
  priority: MoveCategoryResult[];
  pivot: MoveCategoryResult[];
  setup: MoveCategoryResult[];
  hazardSet: MoveCategoryResult[];
  hazardClear: MoveCategoryResult[];
  healing: MoveCategoryResult[];
  status: MoveCategoryResult[];
  disruption: MoveCategoryResult[];
  support: MoveCategoryResult[];
}

const HEALING_MOVES = new Set([
  "Recover", "Roost", "Wish", "Synthesis", "Moonlight", "Morning Sun",
  "Slack Off", "Soft-Boiled", "Shore Up", "Strength Sap", "Rest",
]);

const STATUS_VALUES = new Set(["par", "brn", "slp", "psn", "tox", "frz"]);

const SCREEN_SIDE_CONDITIONS = new Set(["reflect", "lightscreen", "auroraveil"]);

const DISRUPTION_MOVES = new Set([
  "Taunt", "Encore", "Disable", "Torment",
  "Trick", "Switcheroo",
  "Whirlwind", "Roar", "Dragon Tail", "Circle Throw",
  "Perish Song", "Haze", "Clear Smog", "Yawn",
]);

function toMoveId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function categorizeTeamMoves(
  team: DraftPokemon[],
  gen: number,
): Promise<AllMoveCategoryResults> {
  const generation = generations.get(gen);

  const hazardMoveIds = new Set(HAZARD_MOVES.map(toMoveId));
  const clearMoveIds = new Set(CLEAR_MOVES.map(toMoveId));
  const pivotMoveIds = new Set(PIVOT_MOVES.map(toMoveId));
  const priorityMoveIds = new Set(PRIORITY_MOVES.map(toMoveId));
  const healingMoveIds = new Set([...HEALING_MOVES].map(toMoveId));
  const disruptionMoveIds = new Set([...DISRUPTION_MOVES].map(toMoveId));

  const learnsets = await Promise.all(
    team.map((p) => getLearnable(p.name, gen))
  );

  const result: AllMoveCategoryResults = {
    priority: [],
    pivot: [],
    setup: [],
    hazardSet: [],
    hazardClear: [],
    healing: [],
    status: [],
    disruption: [],
    support: [],
  };

  for (let i = 0; i < team.length; i++) {
    const p = team[i];
    const learnable = learnsets[i];
    if (!learnable) continue;

    const genPrefix = String(gen);
    const moveIds = Object.keys(learnable).filter((id) =>
      learnable[id].some((method) => method.startsWith(genPrefix)),
    );

    const priorityMoves: string[] = [];
    const pivotMoves: string[] = [];
    const setupMoves: string[] = [];
    const hazardSetMoves: string[] = [];
    const hazardClearMoves: string[] = [];
    const supportMoves: string[] = [];
    const healingMovesList: string[] = [];
    const statusMoves: string[] = [];
    const disruptionMoves: string[] = [];

    for (const moveId of moveIds) {
      const moveData = generation.moves.get(moveId);
      if (!moveData) continue;
      const moveName = moveData.name;

      // Priority — offensive only (Physical or Special)
      if (
        moveData.category !== "Status" &&
        (priorityMoveIds.has(moveId) || (moveData.priority != null && moveData.priority > 0))
      ) {
        priorityMoves.push(moveName);
      }

      // Pivot
      if (pivotMoveIds.has(moveId)) {
        pivotMoves.push(moveName);
      }

      // Setup — self-boosting moves
      if (moveData.boosts) {
        const boosts = moveData.boosts as Record<string, number>;
        const hasSelfBoost = Object.values(boosts).some((v) => v > 0);
        if (hasSelfBoost) {
          setupMoves.push(moveName);
        }
      }

      // Hazard set
      if (hazardMoveIds.has(moveId)) {
        hazardSetMoves.push(moveName);
      }

      // Hazard clear
      if (clearMoveIds.has(moveId)) {
        hazardClearMoves.push(moveName);
      }

      // Healing
      if (healingMoveIds.has(moveId) || (moveData.flags && (moveData.flags as Record<string, unknown>)["heal"])) {
        healingMovesList.push(moveName);
      }

      // Status
      if (moveData.status && STATUS_VALUES.has(moveData.status as string)) {
        statusMoves.push(moveName);
      }

      // Disruption — anti-setup and option-limiting moves
      if (disruptionMoveIds.has(moveId)) {
        disruptionMoves.push(moveName);
      }

      // Support — weather, terrain, screens
      if (
        moveData.weather ||
        moveData.terrain ||
        (moveData.sideCondition && SCREEN_SIDE_CONDITIONS.has(moveData.sideCondition as string))
      ) {
        supportMoves.push(moveName);
      }
    }

    const entry = (moves: string[]): MoveCategoryResult => ({
      pokemonName: p.name,
      pokemonIcon: p.icon,
      moves,
    });

    if (priorityMoves.length > 0) result.priority.push(entry(priorityMoves));
    if (pivotMoves.length > 0) result.pivot.push(entry(pivotMoves));
    if (setupMoves.length > 0) result.setup.push(entry(setupMoves));
    if (hazardSetMoves.length > 0) result.hazardSet.push(entry(hazardSetMoves));
    if (hazardClearMoves.length > 0) result.hazardClear.push(entry(hazardClearMoves));
    if (healingMovesList.length > 0) result.healing.push(entry(healingMovesList));
    if (statusMoves.length > 0) result.status.push(entry(statusMoves));
    if (disruptionMoves.length > 0) result.disruption.push(entry(disruptionMoves));
    if (supportMoves.length > 0) result.support.push(entry(supportMoves));
  }

  return result;
}
