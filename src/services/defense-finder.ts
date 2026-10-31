import type { Move as PkmnMove } from "@pkmn/data";
import { generations, getDexSpecies } from "./pokemon-data";
import {
  buildAttacker,
  buildDefender,
  counterSpread,
  effectiveWeather,
  runCalc,
  type FieldOptions,
  type TerrainOption,
  type WeatherOption,
} from "./damage";
import {
  abilitiesOf,
  getDamagingMoves,
  isUsableMove,
  moveTags,
  requiredItemOf,
  type DefenderSpread,
  type RunControl,
} from "./offense-finder";
import type { SmogonSet } from "./smogon";
import type { DraftPokemon } from "./types";

/**
 * Defense Finder — every opponent × my-Pokémon pairing, calced both ways.
 *
 * For each pair it finds their hardest hit into me and my hardest hit back,
 * turns the calc's KO counts into a turn race (who moves first, who needs
 * fewer hits), and labels the matchup from each side:
 *  - counters:  wins even after switching into the other's attack
 *  - checks:    wins from a neutral start, but can't switch in
 *  - switch-in: survives the switch-in hit plus one more, but doesn't win
 *  - loses
 *
 * Builds: each side uses its standard Smogon set (or a stated fallback).
 * Options swap their attackers for a max-offense build and my defenders for
 * a max-bulk build in the hit's defense. Unpinned abilities always take the
 * one that's worst for me, in both directions.
 */

/** "standard": their Smogon set · "max": 252+ in the attacking stat with Band/Specs */
export type AttackerMode = "standard" | "max";
/** "standard": my Smogon set · "max": 252 HP / 252+ in the defense the hit targets */
export type BulkMode = "standard" | "max";
/** Which moves each side may use */
export type MovePool = "learnset" | "smogon";
/** "worst": their KO counts at the best roll for them, mine at the worst · "likely": ≥50% of rolls */
export type RollMode = "worst" | "likely";

export interface DefenseFinderOptions {
  attackerMode: AttackerMode;
  bulkMode: BulkMode;
  movePool: MovePool;
  rolls: RollMode;
  /** Their Tera captains may Tera into the type of the move they're using */
  oppTera: boolean;
  weather: WeatherOption;
  terrain: TerrainOption;
  level: number;
}

export const DEFAULT_DEFENSE_OPTIONS: DefenseFinderOptions = {
  attackerMode: "standard",
  bulkMode: "standard",
  movePool: "learnset",
  rolls: "worst",
  oppTera: true,
  weather: "",
  terrain: "",
  level: 100,
};

export interface SideBuild {
  pokemon: DraftPokemon;
  /** Smogon's standard set, null when Smogon lists none */
  smogonSet: SmogonSet | null;
  /** Smogon set spread, or the fallback; ability "" means unpinned */
  standard: DefenderSpread;
  abilityCandidates: string[];
  /** Speed of the standard build, Choice Scarf / Booster Energy included */
  speed: number;
  /** Speed of the max-offense build (252 Spe, neutral nature) */
  maxOffenseSpeed: number;
  /** Moves this side was allowed to use */
  movePoolSize: number;
}

export interface Hit {
  move: string;
  moveType: string;
  category: "Physical" | "Special";
  priority: number;
  accuracy: number;
  minPercent: number;
  maxPercent: number;
  /** Fewest hits that can KO (calc's KO chance, incl. Leftovers etc.); 0 = not within 9 */
  koN: number;
  /** Chance that koN hits KO */
  koChance: number;
  usesTera: boolean;
  attackerAbility: string;
  attackerItem: string;
  attackerNature: string;
  defenderAbility: string;
  tags: string[];
  desc: string;
}

export type Verdict = "counters" | "checks" | "switch-in" | "loses";

export interface Matchup {
  oppIndex: number;
  myIndex: number;
  /** Their hardest hit into me (null: no damaging move) */
  theirHit: Hit | null;
  /** My hardest hit into them */
  myHit: Hit | null;
  /** Hits each side needs under the roll mode (Infinity: can't KO within 9) */
  theirHits: number;
  myHits: number;
  theirSpeed: number;
  mySpeed: number;
  theyMoveFirst: boolean;
  firstBy: "priority" | "speed" | "tie";
  /** How the matchup goes for me / for them */
  you: Verdict;
  them: Verdict;
}

export interface DefenseFinderResult {
  opp: SideBuild[];
  mine: SideBuild[];
  /** Indexed [oppIndex][myIndex] */
  matchups: Matchup[][];
  /** Opponent indices, biggest threat first */
  threatOrder: number[];
  threatScore: number[];
  calcCount: number;
}

// ── Pure helpers ──

/** Hits a side needs to KO: `forThem` counts are judged generously for the attacker in worst-case mode */
export function hitsNeeded(hit: Hit | null, rolls: RollMode, forThem: boolean): number {
  if (!hit || hit.koN === 0) return Infinity;
  // A KO that's possible at n hits is all but guaranteed at n + 1 (rolls span ≤15%)
  if (rolls === "likely") return hit.koChance >= 0.5 ? hit.koN : hit.koN + 1;
  // Worst case for me: any roll counts for them, only a guaranteed KO counts for me
  if (forThem) return hit.koN;
  return hit.koChance >= 0.999 ? hit.koN : hit.koN + 1;
}

/** Turn race between me and them; speed ties go to them */
export function judge(myHits: number, theirHits: number, theyMoveFirst: boolean): { you: Verdict; them: Verdict } {
  const youWin = (mine: number, theirs: number) =>
    Number.isFinite(mine) && theirs > 0 && (theyMoveFirst ? mine < theirs : mine <= theirs);
  const theyWin = (theirs: number, mine: number) =>
    Number.isFinite(theirs) && mine > 0 && (theyMoveFirst ? theirs <= mine : theirs < mine);
  const verdict = (switchWin: boolean, neutralWin: boolean, survivesTwo: boolean): Verdict =>
    switchWin ? "counters" : neutralWin ? "checks" : survivesTwo ? "switch-in" : "loses";
  return {
    // Switching in costs a free hit: the switcher's opponent needs one fewer
    you: verdict(youWin(myHits, theirHits - 1), youWin(myHits, theirHits), theirHits >= 3),
    them: verdict(theyWin(theirHits, myHits - 1), theyWin(theirHits, myHits), myHits >= 3),
  };
}

const VERDICT_SCORE: Record<Verdict, number> = { counters: 3, checks: 2, "switch-in": 0, loses: 0 };

/** Their threat: how many of my mons they beat, plus OHKOs */
export function threatScoreOf(row: Matchup[]): number {
  return row.reduce((acc, m) => acc + VERDICT_SCORE[m.them] + (m.theirHits === 1 ? 1 : 0), 0);
}

export interface CoreCoverage {
  members: number[];
  countered: number;
  /** Checked or better */
  answered: number;
  switchIns: number;
  /** Opponent indices nobody in the core counters, checks or can switch into */
  uncovered: number[];
}

export function coreCoverage(result: DefenseFinderResult, members: number[]): CoreCoverage {
  let countered = 0, answered = 0, switchIns = 0;
  const uncovered: number[] = [];
  result.matchups.forEach((row, t) => {
    const verdicts = members.map((m) => row[m].you);
    if (verdicts.includes("counters")) countered++;
    if (verdicts.includes("counters") || verdicts.includes("checks")) answered++;
    else if (verdicts.includes("switch-in")) switchIns++;
    else uncovered.push(t);
  });
  return { members, countered, answered, switchIns, uncovered };
}

/** Best cores of `size` from my roster, ranked by threats countered, then answered */
export function suggestCores(result: DefenseFinderResult, size = 2, count = 3): CoreCoverage[] {
  const n = result.mine.length;
  const all: CoreCoverage[] = [];
  (function rec(start: number, chosen: number[]) {
    if (chosen.length === size) { all.push(coreCoverage(result, [...chosen])); return; }
    for (let i = start; i < n; i++) rec(i + 1, [...chosen, i]);
  })(0, []);
  const score = (c: CoreCoverage) => c.countered * 100 + c.answered * 10 + c.switchIns;
  return all.sort((a, b) => score(b) - score(a)).slice(0, count);
}

// ── Builds ──

function standardSpread(p: DraftPokemon, set: SmogonSet | null): DefenderSpread {
  const abilities = abilitiesOf(p);
  if (set) {
    return {
      ability: abilities.includes(set.ability) ? set.ability : "",
      // Focus Sash is deliberately out of scope
      item: set.item === "Focus Sash" ? "" : set.item,
      nature: set.nature,
      evs: set.evs,
    };
  }
  const species = getDexSpecies(p.name);
  const focus = p.baseStats.atk >= p.baseStats.spa ? "atk" : "spa";
  return {
    ability: "",
    item: requiredItemOf(p.name) ?? (species?.nfe ? "Eviolite" : ""),
    nature: "Serious",
    evs: { hp: 252, atk: 0, def: 0, spa: 0, spd: 0, spe: 4, [focus]: 252 },
  };
}

/** Abilities that only cut damage at full HP — later hits land at full strength */
const FULL_HP_ABILITIES = new Set(["Multiscale", "Shadow Shield", "Tera Shell"]);

/** Ranking weight: shaky moves lose near-ties to reliable ones (the hit shown keeps its real numbers) */
function moveWeight(move: PkmnMove): number {
  const acc = move.accuracy === true ? 100 : move.accuracy;
  const conditional = moveTags(move).some((t) => t !== "Assumes avg. hits");
  return (acc / 100) * (conditional ? 0.5 : 1);
}

function isSelfDefeating(move: PkmnMove): boolean {
  if (move.selfdestruct) return true;
  return !!move.self && (move.self as { volatileStatus?: string }).volatileStatus === "mustrecharge";
}

const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

// ── Main entry ──

export async function findDefensiveMatchups(
  myTeam: DraftPokemon[],
  oppTeam: DraftPokemon[],
  gen: number,
  options: DefenseFinderOptions = DEFAULT_DEFENSE_OPTIONS,
  control: RunControl = {},
  /** Smogon standard sets, index-aligned with each team (missing → fallback build) */
  oppSets: (SmogonSet | null)[] = [],
  mySets: (SmogonSet | null)[] = [],
): Promise<DefenseFinderResult | null> {
  const cancelled = () => control.isCancelled?.() ?? false;
  const generation = generations.get(gen);
  const field: FieldOptions = { weather: options.weather, terrain: options.terrain, stealthRock: false };
  const level = options.level;
  let calcCount = 0;
  let sinceYield = 0;

  async function tick() {
    if (++sinceYield >= 400) {
      sinceYield = 0;
      await yieldToUi();
    }
  }

  async function sideBuild(p: DraftPokemon, set: SmogonSet | null): Promise<{ build: SideBuild; moves: PkmnMove[] }> {
    const standard = standardSpread(p, set);
    const abilityCandidates = abilitiesOf(p);
    const ability = standard.ability || abilityCandidates[0];
    const probe = buildDefender(gen, { species: p.name, ability, item: "", nature: standard.nature, evs: standard.evs, level });
    let speed = probe.stats.spe;
    if (standard.item === "Choice Scarf") speed = Math.floor(speed * 1.5);
    const paradox = (standard.ability ? [standard.ability] : abilityCandidates)
      .some((a) => a === "Protosynthesis" || a === "Quark Drive");
    if (standard.item === "Booster Energy" && paradox) {
      const { atk, def, spa, spd, spe } = probe.stats;
      if (spe > Math.max(atk, def, spa, spd)) speed = Math.floor(speed * 1.5);
    }
    const maxOffenseSpeed = buildAttacker(gen, { species: p.name, nature: "Adamant", ability, item: "", level }).stats.spe;

    let moves: PkmnMove[];
    if (options.movePool === "smogon" && set) {
      moves = set.moves
        .map((m) => generation.moves.get(m))
        .filter((m): m is PkmnMove => !!m && m.category !== "Status");
    } else {
      moves = await getDamagingMoves(p.name, gen);
    }
    moves = moves.filter((m) => !isSelfDefeating(m));
    return {
      build: { pokemon: p, smogonSet: set, standard, abilityCandidates, speed, maxOffenseSpeed, movePoolSize: moves.length },
      moves,
    };
  }

  const oppSides = await Promise.all(oppTeam.map((p, t) => sideBuild(p, oppSets[t] ?? null)));
  const mySides = await Promise.all(myTeam.map((p, m) => sideBuild(p, mySets[m] ?? null)));
  if (cancelled()) return null;

  type CalcPokemon = ReturnType<typeof buildDefender>;
  interface Best {
    attacker: CalcPokemon;
    defender: CalcPokemon;
    move: PkmnMove;
    usesTera: boolean;
    score: number;
    nature: string;
    item: string;
  }

  /**
   * Re-runs the winning config with KO counts. Full-HP abilities (Multiscale,
   * Tera Shell) only soften the first hit, so the rest are calced from the HP
   * left after it — the max roll when they're hitting me, the min when I am.
   */
  function finalize(best: Best | null, forThem: boolean): Hit | null {
    if (!best) return null;
    const out = runCalc(gen, best.attacker, best.defender, best.move, field, true);
    calcCount++;
    if (out.maxPercent <= 0) return null;
    let ko = out.ko ?? { n: 0, chance: 0 };
    if (ko.n !== 1 && FULL_HP_ABILITIES.has(best.defender.ability ?? "")) {
      const hp = best.defender.maxHP();
      const after = best.defender.clone();
      after.originalCurHP = Math.max(1, hp - (forThem ? out.maxDamage : out.minDamage));
      const rest = runCalc(gen, best.attacker, after, best.move, field, true);
      calcCount++;
      ko = rest.ko && rest.ko.n > 0 ? { n: rest.ko.n + 1, chance: rest.ko.chance } : { n: 0, chance: 0 };
    }
    return {
      move: best.move.name,
      moveType: best.move.type,
      category: best.move.category as "Physical" | "Special",
      priority: best.move.priority,
      accuracy: best.move.accuracy === true ? 100 : best.move.accuracy,
      minPercent: out.minPercent,
      maxPercent: out.maxPercent,
      koN: ko.n,
      koChance: ko.chance,
      usesTera: best.usesTera,
      attackerAbility: best.attacker.ability ?? "",
      attackerItem: best.item,
      attackerNature: best.nature,
      defenderAbility: best.defender.ability ?? "",
      tags: moveTags(best.move),
      desc: out.desc,
    };
  }

  // My defenders, cached per (my index, ability, spread kind)
  const myDefenderCache = new Map<string, CalcPokemon>();
  function myDefender(m: number, ability: string, category: "Physical" | "Special"): CalcPokemon {
    const kind = options.bulkMode === "max" ? category : "std";
    const key = `${m}|${ability}|${kind}`;
    let mon = myDefenderCache.get(key);
    if (!mon) {
      const side = mySides[m].build;
      const spread = options.bulkMode === "max"
        ? { item: side.standard.item, ...counterSpread(category) }
        : side.standard;
      mon = buildDefender(gen, { species: side.pokemon.name, ability, item: spread.item, nature: spread.nature, evs: spread.evs, level });
      myDefenderCache.set(key, mon);
    }
    return mon;
  }

  // Their defenders: always the standard build
  const oppDefenderCache = new Map<string, CalcPokemon>();
  function oppDefender(t: number, ability: string): CalcPokemon {
    const key = `${t}|${ability}`;
    let mon = oppDefenderCache.get(key);
    if (!mon) {
      const s = oppSides[t].build.standard;
      mon = buildDefender(gen, { species: oppTeam[t].name, ability, item: s.item, nature: s.nature, evs: s.evs, level });
      oppDefenderCache.set(key, mon);
    }
    return mon;
  }

  const matchups: Matchup[][] = [];
  const totalPairs = Math.max(1, oppTeam.length * myTeam.length);

  for (let t = 0; t < oppTeam.length; t++) {
    const opp = oppSides[t].build;
    const oppAbilities = opp.standard.ability ? [opp.standard.ability] : opp.abilityCandidates;
    const canTera = options.oppTera && opp.pokemon.isTeraCaptain && gen === 9;
    const required = requiredItemOf(opp.pokemon.name);

    // Their attackers, cached per (ability, category, tera type)
    const attackerCache = new Map<string, { mon: CalcPokemon; nature: string; item: string }>();
    function oppAttacker(ability: string, move: PkmnMove, tera: boolean) {
      const category = move.category as "Physical" | "Special";
      const key = `${ability}|${options.attackerMode === "max" ? category : ""}|${tera ? move.type : ""}`;
      let a = attackerCache.get(key);
      if (!a) {
        const teraType = tera ? move.type : undefined;
        if (options.attackerMode === "max") {
          const nature = category === "Physical" ? "Adamant" : "Modest";
          const item = required ?? (category === "Physical" ? "Choice Band" : "Choice Specs");
          a = { mon: buildAttacker(gen, { species: opp.pokemon.name, nature, ability, item, teraType, level }), nature, item };
        } else {
          const s = opp.standard;
          a = {
            mon: buildDefender(gen, { species: opp.pokemon.name, ability, item: s.item, nature: s.nature, evs: s.evs, teraType, level }),
            nature: s.nature,
            item: s.item,
          };
        }
        attackerCache.set(key, a);
      }
      return a;
    }

    const row: Matchup[] = [];
    for (let m = 0; m < myTeam.length; m++) {
      if (cancelled()) return null;
      control.onProgress?.((t * myTeam.length + m) / totalPairs);
      const mine = mySides[m].build;
      const myAbilities = mine.standard.ability ? [mine.standard.ability] : mine.abilityCandidates;

      // Their hardest hit: every choice that's theirs or unknown goes against me
      let theirBest: Best | null = null;
      for (const ability of oppAbilities) {
        const weather = effectiveWeather(ability, field);
        for (const move of oppSides[t].moves) {
          if (!isUsableMove(move, weather, false)) continue;
          for (const tera of canTera ? [false, true] : [false]) {
            const a = oppAttacker(ability, move, tera);
            for (const myAbility of myAbilities) {
              const defender = myDefender(m, myAbility, move.category as "Physical" | "Special");
              const out = runCalc(gen, a.mon, defender, move, field);
              calcCount++;
              await tick();
              const score = out.maxPercent * moveWeight(move);
              if (!theirBest || score > theirBest.score) {
                theirBest = { attacker: a.mon, defender, move, usesTera: tera, score, nature: a.nature, item: a.item };
              }
            }
          }
        }
      }

      // My hardest hit back: my Smogon set vs. theirs, unknown abilities against me
      let myBest: Best | null = null;
      const myStd = mine.standard;
      const myAttackers = myAbilities.map((ability) => buildDefender(gen, {
        species: mine.pokemon.name, ability, item: myStd.item, nature: myStd.nature, evs: myStd.evs, level,
      }));
      for (const move of mySides[m].moves) {
        let worstForMe: Best | null = null;
        for (const [k, myAbility] of myAbilities.entries()) {
          if (!isUsableMove(move, effectiveWeather(myAbility, field), false)) continue;
          const attacker = myAttackers[k];
          for (const oppAbility of oppAbilities) {
            const defender = oppDefender(t, oppAbility);
            const out = runCalc(gen, attacker, defender, move, field);
            calcCount++;
            await tick();
            const score = out.minPercent * moveWeight(move);
            if (!worstForMe || score < worstForMe.score) {
              worstForMe = { attacker, defender, move, usesTera: false, score, nature: myStd.nature, item: myStd.item };
            }
          }
        }
        if (worstForMe && (!myBest || worstForMe.score > myBest.score)) myBest = worstForMe;
      }

      const theirHit = finalize(theirBest, true);
      const myHit = finalize(myBest, false);
      const theirHits = hitsNeeded(theirHit, options.rolls, true);
      const myHits = hitsNeeded(myHit, options.rolls, false);
      const theirSpeed = options.attackerMode === "max" ? opp.maxOffenseSpeed : opp.speed;
      const mySpeed = mine.speed;
      const theirPri = theirHit?.priority ?? 0;
      const myPri = myHit?.priority ?? 0;
      const firstBy = theirPri !== myPri ? "priority" : theirSpeed !== mySpeed ? "speed" : "tie";
      const theyMoveFirst = firstBy === "priority" ? theirPri > myPri : theirSpeed >= mySpeed;
      row.push({
        oppIndex: t,
        myIndex: m,
        theirHit,
        myHit,
        theirHits,
        myHits,
        theirSpeed,
        mySpeed,
        theyMoveFirst,
        firstBy,
        ...judge(myHits, theirHits, theyMoveFirst),
      });
    }
    matchups.push(row);
  }

  control.onProgress?.(1);
  const threatScore = matchups.map(threatScoreOf);
  const threatOrder = oppTeam.map((_, t) => t).sort((a, b) => threatScore[b] - threatScore[a]);

  return {
    opp: oppSides.map((s) => s.build),
    mine: mySides.map((s) => s.build),
    matchups,
    threatOrder,
    threatScore,
    calcCount,
  };
}
