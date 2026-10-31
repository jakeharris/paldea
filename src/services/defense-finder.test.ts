import { describe, it, expect } from "vitest";
import { getDexSpecies, toDraftPokemon } from "./pokemon-data";
import {
  coreCoverage,
  findDefensiveMatchups,
  hitsNeeded,
  judge,
  suggestCores,
  DEFAULT_DEFENSE_OPTIONS,
  type Hit,
} from "./defense-finder";
import type { SmogonSet } from "./smogon";
import type { DraftPokemon } from "./types";

function mon(name: string, tera = false): DraftPokemon {
  const species = getDexSpecies(name);
  if (!species) throw new Error(`Unknown species ${name}`);
  return { ...toDraftPokemon(species), isTeraCaptain: tera };
}

const smogon = (s: Omit<SmogonSet, "format" | "teraType"> & Partial<SmogonSet>): SmogonSet =>
  ({ format: "OU", teraType: null, ...s });

const hit = (koN: number, koChance: number) => ({ koN, koChance }) as Hit;

describe("hitsNeeded", () => {
  it("counts their KOs at the best roll and mine at the worst in worst-case mode", () => {
    expect(hitsNeeded(hit(1, 0.2), "worst", true)).toBe(1);
    expect(hitsNeeded(hit(1, 0.2), "worst", false)).toBe(2);
    expect(hitsNeeded(hit(2, 1), "worst", false)).toBe(2);
  });

  it("uses ≥50% of rolls in likely mode", () => {
    expect(hitsNeeded(hit(1, 0.6), "likely", false)).toBe(1);
    expect(hitsNeeded(hit(1, 0.4), "likely", true)).toBe(2);
  });

  it("treats no KO as infinite", () => {
    expect(hitsNeeded(null, "worst", true)).toBe(Infinity);
    expect(hitsNeeded(hit(0, 0), "worst", false)).toBe(Infinity);
  });
});

describe("judge", () => {
  it("lets the faster side win a tie in hits", () => {
    expect(judge(2, 2, false).you).toBe("checks");
    expect(judge(2, 2, true).you).toBe("loses");
    expect(judge(2, 2, true).them).toBe("checks");
  });

  it("charges the switcher a free hit", () => {
    // They need 3, I need 1 and I'm faster: I can take their hit on the way in
    expect(judge(1, 3, false).you).toBe("counters");
    // They OHKO me — no switching in
    expect(judge(1, 1, false).you).toBe("checks");
  });

  it("calls a matchup nobody can win a switch-in when the switcher survives two hits", () => {
    const { you, them } = judge(Infinity, Infinity, true);
    expect(you).toBe("switch-in");
    expect(them).toBe("switch-in");
  });
});

// Smogon's first OU sets (Oct 2026)
const GARCHOMP_SET = smogon({
  name: "Swords Dance", ability: "Rough Skin", item: "Loaded Dice", nature: "Jolly",
  evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 }, moves: ["Swords Dance", "Scale Shot", "Earthquake", "Stone Edge"],
});
const HEATRAN_SET = smogon({
  name: "Offensive", ability: "Flash Fire", item: "Leftovers", nature: "Timid",
  evs: { hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 }, moves: ["Magma Storm", "Earth Power", "Taunt", "Stealth Rock"],
});
const CORVIKNIGHT_SET = smogon({
  name: "Bulky Pivot", ability: "Pressure", item: "Leftovers", nature: "Impish",
  evs: { hp: 248, atk: 0, def: 168, spa: 0, spd: 92, spe: 0 }, moves: ["Brave Bird", "U-turn", "Roost", "Defog"],
});

describe("findDefensiveMatchups", () => {
  const myTeam = [mon("Heatran"), mon("Corviknight")];
  const oppTeam = [mon("Garchomp")];
  const run = (opts = {}) =>
    findDefensiveMatchups(myTeam, oppTeam, 9, { ...DEFAULT_DEFENSE_OPTIONS, movePool: "smogon", ...opts }, {},
      [GARCHOMP_SET], [HEATRAN_SET, CORVIKNIGHT_SET]);

  it("finds Garchomp's Earthquake OHKOing Heatran, so Heatran loses", async () => {
    const r = (await run())!;
    const m = r.matchups[0][0];
    expect(m.theirHit?.move).toBe("Earthquake");
    expect(m.theirHits).toBe(1);
    expect(m.you).toBe("loses");
    expect(m.them).toBe("counters");
    expect(m.theirHit?.desc).toMatch(/Garchomp Earthquake vs\. .*Heatran/);
  });

  it("finds Corviknight walling Garchomp's Smogon moves", async () => {
    const r = (await run())!;
    const m = r.matchups[0][1];
    expect(m.theirHit?.move).not.toBe("Earthquake");
    expect(m.theirHits).toBeGreaterThanOrEqual(3);
    expect(["counters", "switch-in"]).toContain(m.you);
  });

  it("hits harder with a max-offense attacker than the Smogon set", async () => {
    const std = (await run())!.matchups[0][1].theirHit!;
    const max = (await run({ attackerMode: "max" }))!.matchups[0][1].theirHit!;
    expect(max.maxPercent).toBeGreaterThan(std.maxPercent);
    expect(max.attackerItem).toBe("Choice Band");
  });

  it("takes less from the same attacker with max bulk", async () => {
    const std = (await run())!.matchups[0][1].theirHit!;
    const bulk = (await run({ bulkMode: "max" }))!.matchups[0][1].theirHit!;
    expect(bulk.maxPercent).toBeLessThan(std.maxPercent);
  });

  it("only lets Multiscale soften the first hit", async () => {
    const dnite = smogon({
      name: "Dragon Dance", ability: "Multiscale", item: "Heavy-Duty Boots", nature: "Adamant",
      evs: { hp: 0, atk: 252, def: 4, spa: 0, spd: 0, spe: 252 }, moves: ["Dragon Dance", "Extreme Speed", "Earthquake", "Ice Spinner"],
    });
    const chomp = { ...GARCHOMP_SET, moves: ["Stone Edge"] };
    const r = (await findDefensiveMatchups([mon("Dragonite")], [mon("Garchomp")], 9,
      { ...DEFAULT_DEFENSE_OPTIONS, movePool: "smogon" }, {}, [chomp], [dnite]))!;
    const h = r.matchups[0][0].theirHit!;
    expect(h.desc).toMatch(/Multiscale/);
    // The halved first hit alone would need 3+; the full-strength follow-up makes it a 2HKO
    expect(Math.ceil(100 / h.maxPercent)).toBeGreaterThanOrEqual(3);
    expect(r.matchups[0][0].theirHits).toBe(2);
  });

  it("ranks cores by threats countered", async () => {
    const r = (await run())!;
    expect(coreCoverage(r, [0]).uncovered).toEqual([0]);
    const [best] = suggestCores(r, 1, 1);
    expect(best.members).toEqual([1]);
  });

  it("searches full learnsets", async () => {
    const r = (await findDefensiveMatchups(
      [mon("Corviknight")], [mon("Garchomp", true)], 9, DEFAULT_DEFENSE_OPTIONS, {}, [GARCHOMP_SET], [CORVIKNIGHT_SET],
    ))!;
    const m = r.matchups[0][0];
    // Coverage outside the Smogon set (Fire / Electric moves) hits Corviknight harder
    expect(["Fire", "Electric"]).toContain(m.theirHit!.moveType);
    expect(r.calcCount).toBeGreaterThan(50);
  }, 30_000);
});
