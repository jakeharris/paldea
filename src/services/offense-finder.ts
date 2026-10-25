import type { Move as PkmnMove } from "@pkmn/data";
import { generations, getLearnable, getDexSpecies } from "./pokemon-data";
import { calcSpeed } from "./matchup-calc";
import {
  ATTACK_NATURES,
  buildAttacker,
  buildDefender,
  counterSpread,
  effectiveWeather,
  runCalc,
  type AttackNature,
  type DefenderMode,
  type FieldOptions,
  type StatSpread,
} from "./damage";
import type { SmogonSet } from "./smogon";
import type { DraftPokemon } from "./types";

/**
 * Offense Finder — searches my roster for the smallest group of attackers
 * that can OHKO at least `goal` of the opponent's Pokémon, using real damage
 * calcs over each attacker's gen-specific learnset.
 *
 * Search outline:
 *  1. Upper bound: every (attacker, ability, move, target) is calced with the
 *     strongest boosting nature + Choice item. Pairs that can't OHKO even then
 *     are discarded.
 *  2. Exact: surviving pairs are re-calced for every nature × item × ability ×
 *     Tera config. Each config yields per-move KO masks; minimal ≤4-move
 *     combos become candidate attacker sets.
 *  3. Team: combos of 2–4 attackers are scored on coverage and on how much
 *     survives losing any one member, then the top loadouts are picked so
 *     each differs in Pokémon, nature, moves or Tera. Sets that reach the
 *     goal alone are reported separately as solo threats.
 *
 * Defenders: a KO is checked against their standard Smogon set and/or a
 * build made to wall that hit (252 HP / 252+ in the targeted defense, with
 * whichever ability is worst for us). In "worst" mode it must beat both.
 */

export type KoThreshold = "guaranteed" | "likely";

export interface OffenseFinderOptions extends FieldOptions {
  defenderMode: DefenderMode;
  koThreshold: KoThreshold;
  level: number;
  /** Targets each loadout should OHKO (capped at opponent team size) */
  goal: number;
  /** Loadouts to return */
  maxLoadouts: number;
  /** Smallest core worth suggesting — a lone sweeper is too fragile to plan around */
  minCoreSize: number;
}

export const DEFAULT_OFFENSE_OPTIONS: OffenseFinderOptions = {
  defenderMode: "worst",
  koThreshold: "guaranteed",
  level: 100,
  goal: 4,
  maxLoadouts: 5,
  minCoreSize: 2,
  weather: "",
  terrain: "",
  stealthRock: false,
};

/** "faster-standard": beats their Smogon set's speed, but not a max-speed build */
export type SpeedRelation = "priority" | "faster" | "faster-neutral" | "faster-standard" | "slower";

export type DefenderBuildKind = "standard" | "counter";

/** One calc against one defender build */
export interface BuildOutcome {
  minPercent: number;
  maxPercent: number;
  ohkoChance: number;
  ability: string;
  desc: string;
}

export interface KoHit {
  targetIndex: number;
  move: string;
  moveType: string;
  category: "Physical" | "Special";
  minPercent: number;
  maxPercent: number;
  ohkoChance: number;
  accuracy: number;
  usesTera: boolean;
  speed: SpeedRelation;
  /** Ability the limiting defender build had */
  defenderAbility: string;
  /** The build that limited this KO (primary numbers come from it) */
  limitingBuild: DefenderBuildKind;
  /** Per-build results for whichever builds the mode checks */
  vs: Partial<Record<DefenderBuildKind, BuildOutcome>>;
  /** Conditions the KO depends on, e.g. "Recharge turn" */
  tags: string[];
  desc: string;
}

export interface AttackerSet {
  id: string;
  rosterIndex: number;
  pokemon: DraftPokemon;
  nature: AttackNature;
  /** "" means no boosting item is needed */
  item: string;
  ability: string;
  teraType: string | null;
  moves: string[];
  /** Best hit per target this set OHKOs */
  kos: KoHit[];
  mask: number;
  speedStat: number;
  /** Minimum focus-stat EVs that keep every KO (filled for returned sets) */
  minFocusEvs?: number;
}

export interface TargetCoverage {
  targetIndex: number;
  hits: { setId: string; hit: KoHit }[];
}

export interface Loadout {
  id: string;
  sets: AttackerSet[];
  coveredMask: number;
  covered: number;
  coverage: TargetCoverage[];
  usesTera: boolean;
  /** Covered by a full-roll, accurate, condition-free hit */
  reliable: number;
  /** Covered by a hit that moves first */
  firstStrike: number;
  /** Covered by two or more sets */
  redundant: number;
  /** Fewest targets still covered after losing any one member */
  resilience: number;
  /** Members whose loss drops coverage below the goal */
  pointsOfFailure: string[];
  /** Uses more Pokémon than the minimum (to fill the list or add redundancy) */
  extraMon: boolean;
}

/** A concrete defender build the finder calcs against */
export interface DefenderSpread {
  ability: string;
  item: string;
  nature: string;
  evs: StatSpread;
}

export interface TargetInfo {
  pokemon: DraftPokemon;
  /** Smogon's standard set, null when Smogon lists none */
  smogonSet: SmogonSet | null;
  /** The "normal" build: Smogon set, or 252 HP neutral fallback */
  standard: DefenderSpread;
  /** Abilities tried when the ability isn't pinned (fallback / counter build) */
  abilityCandidates: string[];
  /** Item for the counter build — same as the standard build */
  counterItem: string;
  standardSpeed: number;
  /** Abilities that make a full-HP OHKO impossible without Mold Breaker */
  ohkoBlockers: string[];
}

export interface OffenseFinderResult {
  targets: TargetInfo[];
  goal: number;
  /** Fewest attackers that reach the goal, null if nothing reaches it */
  minMons: number | null;
  bestCoverage: number;
  loadouts: Loadout[];
  /** Single sets that reach the goal alone — worth knowing, too fragile to build around */
  soloThreats: AttackerSet[];
  /** Targets nothing on my team can OHKO under these assumptions */
  unkoable: number[];
  calcCount: number;
}

export interface RunControl {
  isCancelled?: () => boolean;
  onProgress?: (fraction: number) => void;
}

// ── Move pool ──

/** Moves whose damage depends on conditions a calc can't model */
const EXCLUDED_MOVES = new Set([
  "dreameater", "belch", "lastresort", "steelroller", "synchronoise", "snore",
  "spitup", "naturalgift", "fling", "shelltrap", "counter", "mirrorcoat",
  "metalburst", "comeuppance", "bide", "endeavor", "finalgambit", "superfang",
  "ruination", "naturesmadness", "guardianofalola", "present", "magnitude",
  "beatup", "doomdesire", "futuresight", "skydrop", "round", "echoedvoice",
  "furycutter", "iceball", "rollout", "trumpcard", "uproar",
]);

const CONDITION_TAGS: Record<string, string> = {
  focuspunch: "Needs a free turn",
  suckerpunch: "Target must attack",
  thunderclap: "Target must attack",
  fakeout: "First turn out only",
  firstimpression: "First turn out only",
  upperhand: "Target must use priority",
};

function moveTags(move: PkmnMove): string[] {
  const tags: string[] = [];
  const cond = CONDITION_TAGS[move.id];
  if (cond) tags.push(cond);
  if (move.self && (move.self as { volatileStatus?: string }).volatileStatus === "mustrecharge") {
    tags.push("Recharge turn");
  }
  if (move.selfdestruct) tags.push("User faints");
  if (Array.isArray(move.multihit)) tags.push(`Assumes avg. hits`);
  return tags;
}

function isUsableMove(move: PkmnMove, weather: string): boolean {
  if (move.category === "Status") return false;
  if (move.isZ || move.isMax || move.ohko) return false;
  if (EXCLUDED_MOVES.has(move.id)) return false;
  if (move.flags.charge) {
    if ((move.id === "solarbeam" || move.id === "solarblade") && weather.includes("Sun")) return true;
    if (move.id === "electroshot" && weather.includes("Rain")) return true;
    return false;
  }
  return true;
}

async function getDamagingMoves(name: string, gen: number): Promise<PkmnMove[]> {
  const learnable = await getLearnable(name, gen);
  if (!learnable) return [];
  // learnable() accumulates every gen — keep only moves learnable in `gen`
  const genPrefix = String(gen);
  const generation = generations.get(gen);
  const moves: PkmnMove[] = [];
  for (const id of Object.keys(learnable)) {
    if (!learnable[id].some((m) => m.startsWith(genPrefix))) continue;
    const move = generation.moves.get(id);
    if (move && move.category !== "Status") moves.push(move);
  }
  return moves;
}

function abilitiesOf(p: DraftPokemon): string[] {
  return [...new Set([p.abilities.primary, p.abilities.secondary, p.abilities.hidden].filter(
    (a): a is string => !!a,
  ))];
}

function requiredItemOf(name: string): string | undefined {
  const species = getDexSpecies(name);
  return species?.requiredItem ?? species?.requiredItems?.[0];
}

function itemOptions(p: DraftPokemon, nature: AttackNature, abilities: string[]): string[] {
  const required = requiredItemOf(p.name);
  if (required) return [required];
  const choice = ATTACK_NATURES[nature].focus === "atk" ? "Choice Band" : "Choice Specs";
  const items = ["", "Life Orb", choice];
  if (abilities.some((a) => a === "Protosynthesis" || a === "Quark Drive")) items.splice(1, 0, "Booster Energy");
  return items;
}

/** Lower is preferred: don't spend a Choice lock on a KO that doesn't need it */
function itemCost(item: string): number {
  if (item === "") return 0;
  if (item === "Booster Energy") return 1;
  if (item === "Life Orb") return 2;
  if (item.startsWith("Choice")) return 3;
  return 0;
}

function popcount(n: number): number {
  let c = 0;
  while (n) { n &= n - 1; c++; }
  return c;
}

function meetsThreshold(chance: number, threshold: KoThreshold): boolean {
  return threshold === "guaranteed" ? chance >= 0.999 : chance >= 0.5;
}

/** Ranks two hits on the same target; higher is better */
function hitQuality(h: KoHit): number {
  const speedScore =
    h.speed === "priority" || h.speed === "faster" ? 2 :
    h.speed === "faster-neutral" ? 1 :
    h.speed === "faster-standard" ? 0.5 : 0;
  return (
    h.ohkoChance * 100 +
    (h.accuracy >= 100 ? 30 : h.accuracy - 70) +
    speedScore * 15 -
    h.tags.length * 25 -
    (h.usesTera ? 10 : 0) +
    Math.min(h.minPercent - 100, 50) / 5
  );
}

function isReliable(h: KoHit): boolean {
  return h.ohkoChance >= 0.999 && h.accuracy >= 90 && h.tags.length === 0;
}

function isFirstStrike(h: KoHit): boolean {
  return h.speed !== "slower";
}

function combinations<T>(items: T[], k: number): T[][] {
  const out: T[][] = [];
  const combo: T[] = [];
  (function rec(start: number) {
    if (combo.length === k) { out.push([...combo]); return; }
    for (let i = start; i < items.length; i++) {
      combo.push(items[i]);
      rec(i + 1);
      combo.pop();
    }
  })(0);
  return out;
}

const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

// ── Main entry ──

export async function findOffensiveLoadouts(
  myTeam: DraftPokemon[],
  oppTeam: DraftPokemon[],
  gen: number,
  options: OffenseFinderOptions = DEFAULT_OFFENSE_OPTIONS,
  control: RunControl = {},
  /** Smogon standard sets, index-aligned with oppTeam (missing → fallback build) */
  smogonSets: (SmogonSet | null)[] = [],
): Promise<OffenseFinderResult | null> {
  const cancelled = () => control.isCancelled?.() ?? false;
  const generation = generations.get(gen);
  const field: FieldOptions = { weather: options.weather, terrain: options.terrain, stealthRock: options.stealthRock };
  const goal = Math.min(options.goal, oppTeam.length);
  let calcCount = 0;
  let sinceYield = 0;

  async function tick() {
    if (++sinceYield >= 400) {
      sinceYield = 0;
      await yieldToUi();
    }
  }

  // Defender context
  const targets: TargetInfo[] = oppTeam.map((p, t) => {
    const species = getDexSpecies(p.name);
    const abilities = abilitiesOf(p);
    const set = smogonSets[t] ?? null;
    const fallbackItem = requiredItemOf(p.name) ?? (species?.nfe ? "Eviolite" : "");
    // Focus Sash is deliberately out of scope
    const item = set ? (set.item === "Focus Sash" ? "" : set.item) : fallbackItem;
    const standard: DefenderSpread = set
      ? { ability: abilities.includes(set.ability) ? set.ability : "", item, nature: set.nature, evs: set.evs }
      : { ability: "", item, nature: "Serious", evs: { hp: 252, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } };
    const speedProbe = buildDefender(gen, {
      species: p.name, ability: standard.ability || abilities[0], item: "", nature: standard.nature,
      evs: standard.evs, level: options.level,
    });
    return {
      pokemon: p,
      smogonSet: set,
      standard,
      abilityCandidates: abilities,
      counterItem: item,
      standardSpeed: speedProbe.stats.spe,
      ohkoBlockers: abilities.filter((a) => a === "Sturdy" || a === "Disguise" || a === "Ice Face"),
    };
  });
  const oppSpeeds = oppTeam.map((p) => ({
    neutral: calcSpeed(p.baseStats.spe, 252, { plusNature: false, scarf: false, speedStage: 0 }),
    plus: calcSpeed(p.baseStats.spe, 252, { plusNature: true, scarf: false, speedStage: 0 }),
  }));
  const checkedBuilds: DefenderBuildKind[] =
    options.defenderMode === "worst" ? ["standard", "counter"] : [options.defenderMode];

  /** Worse of two outcomes for us */
  function worse(a: BuildOutcome | null, b: BuildOutcome): BuildOutcome {
    if (!a) return b;
    if (b.ohkoChance !== a.ohkoChance) return b.ohkoChance < a.ohkoChance ? b : a;
    return b.minPercent < a.minPercent ? b : a;
  }

  /** Calcs the hit against each checked build; unpinned abilities take the worst case */
  function calcVsTarget(
    attacker: ReturnType<typeof buildAttacker>,
    move: PkmnMove,
    t: number,
  ): { worst: BuildOutcome & { build: DefenderBuildKind }; vs: Partial<Record<DefenderBuildKind, BuildOutcome>> } {
    const target = targets[t];
    const category = move.category as "Physical" | "Special";
    const vs: Partial<Record<DefenderBuildKind, BuildOutcome>> = {};
    let worst: (BuildOutcome & { build: DefenderBuildKind }) | null = null;

    for (const build of checkedBuilds) {
      const spread: DefenderSpread = build === "standard"
        ? target.standard
        : { ability: "", item: target.counterItem, ...counterSpread(category) };
      const abilities = spread.ability ? [spread.ability] : target.abilityCandidates;
      let buildWorst: BuildOutcome | null = null;
      for (const ability of abilities) {
        const defender = buildDefender(gen, {
          species: oppTeam[t].name,
          ability,
          item: spread.item,
          nature: spread.nature,
          evs: spread.evs,
          level: options.level,
        });
        const out = runCalc(gen, attacker, defender, move, field);
        calcCount++;
        buildWorst = worse(buildWorst, { ...out, ability });
      }
      vs[build] = buildWorst!;
      const candidate = { ...buildWorst!, build };
      if (!worst || worse(worst, candidate) === candidate) worst = candidate;
    }
    return { worst: worst!, vs };
  }

  const setsByMon: AttackerSet[][] = [];
  const viableAnywhere = new Set<number>();

  for (let i = 0; i < myTeam.length; i++) {
    if (cancelled()) return null;
    control.onProgress?.(i / myTeam.length * 0.9);

    const mon = myTeam[i];
    const abilities = abilitiesOf(mon);
    const canTera = mon.isTeraCaptain && gen === 9;
    const allMoves = await getDamagingMoves(mon.name, gen);
    const required = requiredItemOf(mon.name);

    // Phase 1: upper bound per (ability, move, tera?, target)
    const viable = new Set<string>(); // `${ability}|${moveId}|${tera}|${t}`
    const usefulMoves = new Map<string, PkmnMove>();
    for (const ability of abilities) {
      const weather = effectiveWeather(ability, field);
      for (const move of allMoves) {
        if (!isUsableMove(move, weather)) continue;
        const nature: AttackNature = move.category === "Physical" ? "Adamant" : "Modest";
        const item = required ?? (move.category === "Physical" ? "Choice Band" : "Choice Specs");
        for (const tera of canTera ? [false, true] : [false]) {
          const attacker = buildAttacker(gen, {
            species: mon.name, nature, ability, item, level: options.level,
            teraType: tera ? move.type : undefined,
          });
          for (let t = 0; t < oppTeam.length; t++) {
            const { worst: out } = calcVsTarget(attacker, move, t);
            await tick();
            if (meetsThreshold(out.ohkoChance, options.koThreshold)) {
              viable.add(`${ability}|${move.id}|${tera}|${t}`);
              usefulMoves.set(move.id, move);
              viableAnywhere.add(t);
            }
          }
        }
      }
    }

    // Phase 2: exact configs
    const teraTypes = canTera
      ? [...new Set([...viable].filter((k) => k.split("|")[2] === "true").map((k) => usefulMoves.get(k.split("|")[1])!.type))]
      : [];
    const bestByKey = new Map<string, AttackerSet>();

    for (const nature of Object.keys(ATTACK_NATURES) as AttackNature[]) {
      const speedStat = calcSpeed(mon.baseStats.spe, 252, {
        plusNature: ATTACK_NATURES[nature].plusSpe, scarf: false, speedStage: 0,
      });
      for (const ability of abilities) {
        for (const item of itemOptions(mon, nature, abilities)) {
          for (const teraType of [null, ...teraTypes]) {
            // Per-move hits under this config
            const moveHits: { move: PkmnMove; mask: number; hits: Map<number, KoHit> }[] = [];
            for (const move of usefulMoves.values()) {
              const usesTera = teraType !== null && move.type === teraType;
              let mask = 0;
              const hits = new Map<number, KoHit>();
              let attacker: ReturnType<typeof buildAttacker> | null = null;
              for (let t = 0; t < oppTeam.length; t++) {
                if (!viable.has(`${ability}|${move.id}|${usesTera}|${t}`)) continue;
                attacker ??= buildAttacker(gen, {
                  species: mon.name, nature, ability, item, level: options.level,
                  teraType: teraType ?? undefined,
                });
                const { worst: out, vs } = calcVsTarget(attacker, move, t);
                await tick();
                if (!meetsThreshold(out.ohkoChance, options.koThreshold)) continue;
                mask |= 1 << t;
                const speed: SpeedRelation =
                  move.priority > 0 ? "priority" :
                  speedStat > oppSpeeds[t].plus ? "faster" :
                  speedStat > oppSpeeds[t].neutral ? "faster-neutral" :
                  targets[t].smogonSet && speedStat > targets[t].standardSpeed ? "faster-standard" : "slower";
                hits.set(t, {
                  targetIndex: t,
                  move: move.name,
                  moveType: move.type,
                  category: move.category as "Physical" | "Special",
                  minPercent: out.minPercent,
                  maxPercent: out.maxPercent,
                  ohkoChance: out.ohkoChance,
                  accuracy: move.accuracy === true ? 100 : move.accuracy,
                  usesTera,
                  speed,
                  defenderAbility: out.ability,
                  limitingBuild: out.build,
                  vs,
                  tags: moveTags(move),
                  desc: out.desc,
                });
              }
              if (mask) moveHits.push({ move, mask, hits });
            }
            if (moveHits.length === 0) continue;

            // Keep the 3 best moves per target so combo enumeration stays small
            const keep = new Set<string>();
            for (let t = 0; t < oppTeam.length; t++) {
              moveHits
                .filter((m) => m.hits.has(t))
                .sort((a, b) => hitQuality(b.hits.get(t)!) - hitQuality(a.hits.get(t)!))
                .slice(0, 3)
                .forEach((m) => keep.add(m.move.id));
            }
            const pool = moveHits.filter((m) => keep.has(m.move.id));

            for (let k = 1; k <= Math.min(4, pool.length); k++) {
              for (const combo of combinations(pool, k)) {
                const mask = combo.reduce((acc, m) => acc | m.mask, 0);
                // Minimal: every move must add a target the others don't
                const minimal = combo.every((m) => {
                  const others = combo.reduce((acc, o) => (o === m ? acc : acc | o.mask), 0);
                  return (m.mask & ~others) !== 0;
                });
                if (!minimal) continue;

                const kos: KoHit[] = [];
                for (let t = 0; t < oppTeam.length; t++) {
                  const best = combo
                    .map((m) => m.hits.get(t))
                    .filter((h): h is KoHit => !!h)
                    .sort((a, b) => hitQuality(b) - hitQuality(a))[0];
                  if (best) kos.push(best);
                }
                // A Tera config only earns its keep if a needed KO uses Tera
                if (teraType && !kos.some((h) => h.usesTera)) continue;

                const moves = combo.map((m) => m.move.name).sort();
                const key = `${nature}|${teraType ?? ""}|${moves.join(",")}`;
                const candidate: AttackerSet = {
                  id: `${i}|${key}`,
                  rosterIndex: i,
                  pokemon: mon,
                  nature,
                  item,
                  ability,
                  teraType,
                  moves,
                  kos,
                  mask,
                  speedStat,
                };
                const prev = bestByKey.get(key);
                if (!prev || isBetterSet(candidate, prev)) bestByKey.set(key, candidate);
              }
            }
          }
        }
      }
    }

    setsByMon.push(pruneSets([...bestByKey.values()]));
  }

  if (cancelled()) return null;
  control.onProgress?.(0.92);
  await yieldToUi();

  const { loadouts, minMons, bestCoverage, soloThreats } = searchLoadouts(
    setsByMon, oppTeam.length, goal, options.maxLoadouts, options.minCoreSize,
  );

  // Fill in minimum EVs for the sets we're showing
  for (const set of new Set([...loadouts.flatMap((l) => l.sets), ...soloThreats])) {
    if (cancelled()) return null;
    set.minFocusEvs = await minFocusEvs(set);
  }

  control.onProgress?.(1);

  return {
    targets,
    goal,
    minMons,
    bestCoverage,
    loadouts,
    soloThreats,
    unkoable: oppTeam.map((_, t) => t).filter((t) => !viableAnywhere.has(t)),
    calcCount,
  };

  /** Smallest focus-stat EV investment (multiple of 4) that keeps every KO */
  async function minFocusEvs(set: AttackerSet): Promise<number> {
    const focus = ATTACK_NATURES[set.nature].focus;
    const relevant = set.kos.filter((h) => (h.category === "Physical") === (focus === "atk"));
    if (relevant.length === 0) return 0;
    const holds = async (evs: number) => {
      const attacker = buildAttacker(gen, {
        species: set.pokemon.name, nature: set.nature, ability: set.ability, item: set.item,
        teraType: set.teraType ?? undefined, focusEvs: evs, level: options.level,
      });
      for (const h of relevant) {
        const move = generation.moves.get(h.move)!;
        const { worst: out } = calcVsTarget(attacker, move, h.targetIndex);
        await tick();
        if (!meetsThreshold(out.ohkoChance, options.koThreshold)) return false;
      }
      return true;
    };
    let lo = 0;
    let hi = 63; // EVs = 4 * step
    if (await holds(0)) return 0;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (await holds(mid * 4)) hi = mid;
      else lo = mid;
    }
    return hi * 4;
  }
}

function setQuality(s: AttackerSet): number {
  const reliable = s.kos.filter(isReliable).length;
  const first = s.kos.filter(isFirstStrike).length;
  const avg = s.kos.reduce((acc, h) => acc + hitQuality(h), 0) / Math.max(1, s.kos.length);
  return popcount(s.mask) * 1000 + reliable * 120 + first * 80 + avg - (s.teraType ? 60 : 0) - itemCost(s.item) * 5;
}

function isBetterSet(a: AttackerSet, b: AttackerSet): boolean {
  if (popcount(a.mask) !== popcount(b.mask)) return popcount(a.mask) > popcount(b.mask);
  // Same coverage: prefer the lighter item commitment, then hit quality
  if (itemCost(a.item) !== itemCost(b.item)) return itemCost(a.item) < itemCost(b.item);
  return setQuality(a) > setQuality(b);
}

/** Drop sets whose targets are a strict subset of a sibling with the same nature & Tera use */
function pruneSets(sets: AttackerSet[], perMon = 8): AttackerSet[] {
  const maximal = sets.filter((s) =>
    !sets.some((o) =>
      o !== s &&
      o.nature === s.nature &&
      !!o.teraType === !!s.teraType &&
      (o.mask & s.mask) === s.mask &&
      o.mask !== s.mask,
    ),
  );
  maximal.sort((a, b) => setQuality(b) - setQuality(a));
  // Keep at least one set per distinct mask before allowing alternates
  const out: AttackerSet[] = [];
  const seenMasks = new Set<string>();
  for (const s of maximal) {
    const k = `${s.mask}|${!!s.teraType}`;
    if (!seenMasks.has(k)) { seenMasks.add(k); out.push(s); }
  }
  for (const s of maximal) {
    if (out.length >= perMon) break;
    if (!out.includes(s)) out.push(s);
  }
  return out.slice(0, Math.max(perMon, seenMasks.size));
}

/** Coverage left after losing each member, in set order */
function coverageWithout(sets: AttackerSet[]): number[] {
  return sets.map((s) => popcount(sets.reduce((acc, o) => (o === s ? acc : acc | o.mask), 0)));
}

function buildLoadout(sets: AttackerSet[], nTargets: number, goal: number, extraMon: boolean): Loadout {
  const coverage: TargetCoverage[] = [];
  let coveredMask = 0;
  for (let t = 0; t < nTargets; t++) {
    const hits = sets
      .flatMap((s) => s.kos.filter((h) => h.targetIndex === t).map((hit) => ({ setId: s.id, hit })))
      .sort((a, b) => hitQuality(b.hit) - hitQuality(a.hit));
    if (hits.length) coveredMask |= 1 << t;
    coverage.push({ targetIndex: t, hits });
  }
  const without = coverageWithout(sets);
  return {
    id: sets.map((s) => s.id).sort().join("+"),
    sets,
    coveredMask,
    covered: popcount(coveredMask),
    coverage,
    usesTera: sets.some((s) => s.teraType),
    reliable: coverage.filter((c) => c.hits.some((h) => isReliable(h.hit))).length,
    firstStrike: coverage.filter((c) => c.hits.some((h) => isFirstStrike(h.hit))).length,
    redundant: coverage.filter((c) => new Set(c.hits.map((h) => h.setId)).size >= 2).length,
    resilience: Math.min(...without),
    pointsOfFailure: sets.filter((_, i) => without[i] < goal).map((s) => s.pokemon.name),
    extraMon,
  };
}

/** Things go wrong in a real game — surviving a lost member weighs nearly as much as coverage */
function loadoutScore(l: Loadout): number {
  const quality = l.sets.reduce((acc, s) => acc + setQuality(s) % 1000, 0) / l.sets.length;
  return (
    l.covered * 1000 + l.resilience * 800 + l.reliable * 120 + l.firstStrike * 80 +
    l.redundant * 60 - (l.usesTera ? 60 : 0) + quality / 10
  );
}

export function searchLoadouts(
  setsByMon: AttackerSet[][],
  nTargets: number,
  goal: number,
  maxLoadouts: number,
  minCoreSize = 1,
): { loadouts: Loadout[]; minMons: number | null; bestCoverage: number; soloThreats: AttackerSet[] } {
  // Solo threats: best single set per mon that reaches the goal by itself
  const soloThreats = setsByMon
    .map((sets) => sets.filter((s) => popcount(s.mask) >= goal).sort((a, b) => setQuality(b) - setQuality(a))[0])
    .filter((s): s is AttackerSet => !!s)
    .sort((a, b) => setQuality(b) - setQuality(a));

  const monIdx = setsByMon.map((s, i) => (s.length ? i : -1)).filter((i) => i >= 0);
  const maxK = Math.min(4, monIdx.length);
  const minK = Math.min(minCoreSize, maxK);
  if (maxK === 0) return { loadouts: [], minMons: null, bestCoverage: 0, soloThreats };

  /** Visit every combo of k attackers (at most one Tera user) */
  function forEachCombo(k: number, visit: (sets: AttackerSet[], mask: number) => void) {
    for (const mons of combinations(monIdx, k)) {
      const chosen: AttackerSet[] = [];
      (function rec(d: number, mask: number, tera: boolean) {
        if (d === mons.length) { visit(chosen, mask); return; }
        for (const s of setsByMon[mons[d]]) {
          if (tera && s.teraType) continue;
          chosen.push(s);
          rec(d + 1, mask | s.mask, tera || !!s.teraType);
          chosen.pop();
        }
      })(0, 0, false);
    }
  }

  let minMons: number | null = null;
  let bestCoverage = 0;
  for (let k = minK; k <= maxK && minMons === null; k++) {
    forEachCombo(k, (_, mask) => { bestCoverage = Math.max(bestCoverage, popcount(mask)); });
    if (bestCoverage >= goal) minMons = k;
  }

  // Shortfall: show the best partial coverage with the most attackers allowed
  const baseK = minMons ?? maxK;
  const threshold = minMons ? goal : bestCoverage;

  /** Top loadouts of size k — a cheap score bounds how many get fully built */
  function rank(k: number, extraMon: boolean): Loadout[] {
    let pool: { sets: AttackerSet[]; cheap: number }[] = [];
    const trim = () => {
      pool.sort((a, b) => b.cheap - a.cheap);
      pool = pool.slice(0, 400);
    };
    forEachCombo(k, (sets, mask) => {
      const covered = popcount(mask);
      if (covered < threshold) return;
      const resilience = Math.min(...coverageWithout(sets));
      const quality = sets.reduce((acc, s) => acc + setQuality(s) % 1000, 0) / sets.length;
      pool.push({ sets: [...sets], cheap: covered * 1000 + resilience * 800 + quality / 10 });
      if (pool.length > 4000) trim();
    });
    trim();
    return pool
      .map((c) => buildLoadout(c.sets, nTargets, goal, extraMon))
      .sort((a, b) => loadoutScore(b) - loadoutScore(a));
  }

  const primary = rank(baseK, false);
  const picked: Loadout[] = [];
  const monKey = (l: Loadout) => l.sets.map((s) => s.rosterIndex).sort().join(",");
  const usedMonKeys = new Set<string>();
  const take = (l: Loadout) => { usedMonKeys.add(monKey(l)); picked.push(l); };

  // One more attacker can buy redundancy the minimum can't — reserve up to 2 slots for it
  const bestResilience = Math.max(0, ...primary.map((l) => l.resilience));
  const bigger = baseK < maxK ? rank(baseK + 1, true) : [];
  const sturdier = bigger.filter((l) => l.resilience > bestResilience);
  const reserved = Math.min(2, sturdier.length, maxLoadouts - 1);

  // 1. Distinct groups of Pokémon at the minimum size
  for (const l of primary) {
    if (picked.length >= maxLoadouts - reserved) break;
    if (!usedMonKeys.has(monKey(l))) take(l);
  }
  // 2. +1 attacker that still covers the goal after losing any one member
  for (const l of sturdier) {
    if (picked.length >= maxLoadouts) break;
    if (usedMonKeys.has(monKey(l))) continue;
    take(l);
    if (picked.filter((p) => p.extraMon).length >= reserved) break;
  }
  // 3. Same Pokémon, but a different nature / moves / Tera on some member
  for (const l of primary) {
    if (picked.length >= maxLoadouts) break;
    if (!picked.some((p) => p.id === l.id)) picked.push(l);
  }
  // 4. Fill with other +1 groups
  for (const l of bigger) {
    if (picked.length >= maxLoadouts) break;
    if (usedMonKeys.has(monKey(l))) continue;
    if (picked.some((p) => p.sets.every((s) => l.sets.some((o) => o.id === s.id)))) continue;
    take(l);
  }

  return { loadouts: picked, minMons, bestCoverage, soloThreats };
}
