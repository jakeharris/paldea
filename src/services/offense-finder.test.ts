import { describe, it, expect } from "vitest";
import { getDexSpecies, generations, toDraftPokemon } from "./pokemon-data";
import { buildAttacker, buildDefender, counterSpread, runCalc, type FieldOptions } from "./damage";
import {
  findOffensiveLoadouts,
  isPremierMove,
  searchLoadouts,
  DEFAULT_OFFENSE_OPTIONS,
  type AttackerSet,
} from "./offense-finder";
import type { SmogonSet } from "./smogon";
import type { DraftPokemon } from "./types";

function mon(name: string, tera = false): DraftPokemon {
  const species = getDexSpecies(name);
  if (!species) throw new Error(`Unknown species ${name}`);
  return { ...toDraftPokemon(species), isTeraCaptain: tera };
}

const noField: FieldOptions = { weather: "", terrain: "", stealthRock: false };
const gen9 = generations.get(9);
const maxHp = { hp: 252 };

describe("damage wrapper", () => {
  it("finds a guaranteed OHKO for a 4x super-effective STAB hit", () => {
    const attacker = buildAttacker(9, { species: "Garchomp", nature: "Adamant", ability: "Rough Skin", item: "Choice Band", level: 100 });
    const defender = buildDefender(9, { species: "Heatran", ability: "Flame Body", item: "", nature: "Serious", evs: maxHp, level: 100 });
    const out = runCalc(9, attacker, defender, gen9.moves.get("Earthquake")!, noField);
    expect(out.ohkoChance).toBe(1);
    expect(out.minPercent).toBeGreaterThan(100);
  });

  it("treats Sturdy as blocking a single-hit OHKO", () => {
    const attacker = buildAttacker(9, { species: "Garchomp", nature: "Adamant", ability: "Rough Skin", item: "Choice Band", level: 100 });
    const defender = buildDefender(9, { species: "Magnezone", ability: "Sturdy", item: "", nature: "Serious", evs: maxHp, level: 100 });
    const out = runCalc(9, attacker, defender, gen9.moves.get("Earthquake")!, noField);
    expect(out.maxPercent).toBeGreaterThan(100);
    expect(out.ohkoChance).toBe(0);
  });

  it("applies Multiscale at full HP", () => {
    const attacker = buildAttacker(9, { species: "Garchomp", nature: "Adamant", ability: "Rough Skin", item: "", level: 100 });
    const mk = (ability: string) =>
      buildDefender(9, { species: "Dragonite", ability, item: "", nature: "Serious", evs: maxHp, level: 100 });
    const outrage = gen9.moves.get("Outrage")!;
    const withScale = runCalc(9, attacker, mk("Multiscale"), outrage, noField);
    const without = runCalc(9, attacker, mk("Inner Focus"), outrage, noField);
    expect(withScale.maxPercent).toBeLessThan(without.maxPercent * 0.6);
  });

  it("builds the counter spread for the defense the hit targets", () => {
    expect(counterSpread("Physical")).toMatchObject({ nature: "Bold", evs: { hp: 252, def: 252 } });
    expect(counterSpread("Special")).toMatchObject({ nature: "Calm", evs: { hp: 252, spd: 252 } });
  });
});

const smogon = (s: Omit<SmogonSet, "format" | "teraType"> & Partial<SmogonSet>): SmogonSet =>
  ({ format: "OU", teraType: null, ...s });

// Smogon's first OU sets for these mons (Oct 2026)
const OPP_SETS: SmogonSet[] = [
  smogon({ name: "The Pex (Defensive)", ability: "Regenerator", item: "Heavy-Duty Boots", nature: "Bold", evs: { hp: 248, atk: 0, def: 252, spa: 0, spd: 8, spe: 0 }, moves: ["Recover", "Toxic", "Haze", "Toxic Spikes"] }),
  smogon({ name: "Dragon Dance", ability: "Multiscale", item: "Heavy-Duty Boots", nature: "Adamant", evs: { hp: 0, atk: 252, def: 4, spa: 0, spd: 0, spe: 252 }, moves: ["Dragon Dance", "Extreme Speed", "Earthquake", "Ice Spinner"] }),
  smogon({ name: "Swords Dance", ability: "Poison Heal", item: "Toxic Orb", nature: "Careful", evs: { hp: 244, atk: 0, def: 36, spa: 0, spd: 228, spe: 0 }, moves: ["Swords Dance", "Facade", "Knock Off", "Protect"] }),
  smogon({ name: "Offensive", ability: "Flash Fire", item: "Leftovers", nature: "Timid", evs: { hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 }, moves: ["Magma Storm", "Earth Power", "Taunt", "Stealth Rock"] }),
  smogon({ name: "Utility", ability: "Magic Guard", item: "Leftovers", nature: "Bold", evs: { hp: 252, atk: 0, def: 252, spa: 0, spd: 4, spe: 0 }, moves: ["Stealth Rock", "Moonblast", "Moonlight", "Thunder Wave"] }),
  smogon({ name: "Booster Energy", ability: "Quark Drive", item: "Booster Energy", nature: "Timid", evs: { hp: 0, atk: 0, def: 124, spa: 132, spd: 0, spe: 252 }, moves: ["Fiery Dance", "Sludge Wave", "Dazzling Gleam", "Substitute"] }),
];

describe("findOffensiveLoadouts", () => {
  const myTeam = [
    mon("Garchomp"), mon("Dragapult", true), mon("Gholdengo"), mon("Great Tusk"),
    mon("Kingambit"), mon("Iron Valiant"), mon("Rotom-Wash"), mon("Volcarona", true),
  ];
  const oppTeam = [
    mon("Toxapex"), mon("Dragonite"), mon("Gliscor"), mon("Heatran"),
    mon("Clefable"), mon("Iron Moth"),
  ];

  it("returns distinct loadouts whose KOs beat both the Smogon set and the counter build", async () => {
    const start = performance.now();
    const result = await findOffensiveLoadouts(myTeam, oppTeam, 9, DEFAULT_OFFENSE_OPTIONS, {}, OPP_SETS);
    const elapsed = performance.now() - start;
    expect(result).not.toBeNull();
    const r = result!;

    console.log(`calcs=${r.calcCount} ms=${elapsed.toFixed(0)} minMons=${r.minMons} best=${r.bestCoverage} unkoable=${r.unkoable.map((t) => oppTeam[t].name)}`);
    console.log(`solo: ${r.soloThreats.map((s) => `${s.pokemon.name} ${s.nature} (${s.kos.length})`).join("; ")}`);
    for (const l of r.loadouts) {
      console.log(`— ${l.covered}/${oppTeam.length} covered, lose-one=${l.resilience} spof=[${l.pointsOfFailure}] tera=${l.usesTera}${l.extraMon ? " (+1 mon)" : ""}`);
      for (const s of l.sets) {
        console.log(`   ${s.pokemon.name} ${s.nature} @ ${s.item || "(any)"} [${s.ability}]${s.teraType ? ` Tera ${s.teraType}` : ""} minEVs=${s.minFocusEvs}: ${s.moves.join(", ")}`);
        for (const h of s.kos) {
          const fmt = (k: "standard" | "counter") => h.vs[k] ? `${k} ${h.vs[k]!.minPercent.toFixed(0)}–${h.vs[k]!.maxPercent.toFixed(0)}%` : "";
          console.log(`      → ${oppTeam[h.targetIndex].name}: ${h.move} ${fmt("standard")} | ${fmt("counter")} (${h.speed})`);
        }
      }
    }

    expect(r.targets.every((t) => t.smogonSet)).toBe(true);
    expect(r.loadouts.length).toBeGreaterThan(0);
    expect(r.loadouts.length).toBeLessThanOrEqual(5);
    expect(new Set(r.loadouts.map((l) => l.id)).size).toBe(r.loadouts.length);

    for (const l of r.loadouts) {
      expect(l.covered).toBeGreaterThanOrEqual(r.minMons !== null ? 4 : r.bestCoverage);
      expect(l.sets.length).toBeGreaterThanOrEqual(2);
      expect(l.sets.length).toBeLessThanOrEqual(4);
      expect(l.sets.filter((s) => s.teraType).length).toBeLessThanOrEqual(1);

      for (const s of l.sets) {
        expect(s.moves.length).toBeLessThanOrEqual(4);
        for (const h of s.kos) {
          expect(s.moves).toContain(h.move);
          // Both builds were checked and each is an OHKO
          expect(h.vs.standard!.ohkoChance).toBeGreaterThanOrEqual(0.999);
          expect(h.vs.counter!.ohkoChance).toBeGreaterThanOrEqual(0.999);

          // Independent recheck against the counter build
          const attacker = buildAttacker(9, {
            species: s.pokemon.name, nature: s.nature, ability: s.ability, item: s.item,
            teraType: s.teraType ?? undefined, level: 100,
          });
          const defender = buildDefender(9, {
            species: oppTeam[h.targetIndex].name, ability: h.vs.counter!.ability,
            item: r.targets[h.targetIndex].counterItem, level: 100, ...counterSpread(h.category),
          });
          expect(runCalc(9, attacker, defender, gen9.moves.get(h.move)!, noField).ohkoChance).toBeGreaterThanOrEqual(0.999);
        }
      }
    }
  }, 60_000);

  it("checks only the Smogon set in standard mode, so it finds at least as many KOs", async () => {
    const worst = await findOffensiveLoadouts(myTeam, oppTeam, 9, DEFAULT_OFFENSE_OPTIONS, {}, OPP_SETS);
    const standard = await findOffensiveLoadouts(myTeam, oppTeam, 9, { ...DEFAULT_OFFENSE_OPTIONS, defenderMode: "standard" }, {}, OPP_SETS);
    expect(standard!.bestCoverage).toBeGreaterThanOrEqual(worst!.bestCoverage);
    const hit = standard!.loadouts[0].sets[0].kos[0];
    expect(hit.vs.standard).toBeDefined();
    expect(hit.vs.counter).toBeUndefined();
  }, 60_000);

  it("falls back to 252 HP neutral for targets without a Smogon set", async () => {
    const r = await findOffensiveLoadouts(myTeam, oppTeam, 9, DEFAULT_OFFENSE_OPTIONS, {}, []);
    expect(r!.targets.every((t) => t.smogonSet === null)).toBe(true);
    expect(r!.targets[0].standard).toMatchObject({ nature: "Serious", evs: { hp: 252, def: 0 }, ability: "" });
  }, 60_000);

  it("reports a shortfall instead of failing when no group reaches the goal", async () => {
    const result = await findOffensiveLoadouts([mon("Blissey"), mon("Chansey")], oppTeam, 9, DEFAULT_OFFENSE_OPTIONS, {}, OPP_SETS);
    expect(result!.goalReached).toBe(false);
    expect(result!.bestCoverage).toBeLessThan(4);
    // Every target nobody OHKOs still gets the roster's best damage
    for (const t of result!.unkoable) {
      expect(result!.rosterBest[t].length).toBeGreaterThan(0);
      expect(result!.rosterBest[t][0].maxPercent).toBeLessThan(200);
    }
  }, 60_000);

  it("restricts to premier moves", async () => {
    const r = await findOffensiveLoadouts(myTeam, oppTeam, 9, { ...DEFAULT_OFFENSE_OPTIONS, premierOnly: true }, {}, OPP_SETS);
    const used = r!.loadouts.flatMap((l) => l.sets.flatMap((s) => s.kos.map((h) => h.move)));
    expect(used.length).toBeGreaterThan(0);
    for (const m of used) expect(isPremierMove(gen9.moves.get(m)!)).toBe(true);
  }, 60_000);

  it("caps Choice items per loadout", async () => {
    const one = await findOffensiveLoadouts(myTeam, oppTeam, 9, { ...DEFAULT_OFFENSE_OPTIONS, choiceLimit: "one" }, {}, OPP_SETS);
    for (const l of one!.loadouts) {
      expect(l.sets.filter((s) => s.item.startsWith("Choice")).length).toBeLessThanOrEqual(1);
    }
    const none = await findOffensiveLoadouts(myTeam, oppTeam, 9, { ...DEFAULT_OFFENSE_OPTIONS, choiceLimit: "none" }, {}, OPP_SETS);
    for (const l of none!.loadouts) {
      expect(l.sets.some((s) => s.item.startsWith("Choice"))).toBe(false);
    }
  }, 60_000);

  it("still shows the best loadouts, with damage for misses, when restrictions sink the goal", async () => {
    const r = await findOffensiveLoadouts(
      myTeam, oppTeam, 9,
      { ...DEFAULT_OFFENSE_OPTIONS, premierOnly: true, choiceLimit: "none", goal: 6 },
      {}, OPP_SETS,
    );
    expect(r!.goalReached).toBe(false);
    expect(r!.loadouts.length).toBeGreaterThan(0);
    for (const l of r!.loadouts) {
      expect(l.covered).toBe(r!.bestCoverage);
      for (const c of l.coverage.filter((c) => c.hits.length === 0)) {
        expect(c.bestEffort).toBeDefined();
        expect(c.bestEffort!.minPercent).toBeLessThan(100);
        const set = l.sets.find((s) => s.id === c.bestEffort!.setId)!;
        // A move outside the set only counts if there's a free slot for it
        if (c.bestEffort!.addsMove) expect(set.moves.length).toBeLessThan(4);
      }
    }
  }, 60_000);

  it("stops early when cancelled", async () => {
    const result = await findOffensiveLoadouts(myTeam, oppTeam, 9, DEFAULT_OFFENSE_OPTIONS, { isCancelled: () => true });
    expect(result).toBeNull();
  });
});

describe("isPremierMove", () => {
  it("keeps accurate, safe moves and drops inaccurate, recharge and self-KO ones", () => {
    for (const m of ["Earthquake", "Flamethrower", "Tera Starstorm"]) expect(isPremierMove(gen9.moves.get(m)!)).toBe(true);
    for (const m of ["Fire Blast", "Explosion", "Hyper Beam"]) expect(isPremierMove(gen9.moves.get(m)!)).toBe(false);
  });
});

describe("searchLoadouts", () => {
  const fake = (rosterIndex: number, mask: number, item = ""): AttackerSet => ({
    id: `${rosterIndex}|${mask}|${item}`,
    rosterIndex,
    pokemon: { ...mon("Garchomp"), name: `Mon${rosterIndex}` },
    nature: "Jolly",
    item,
    ability: "Rough Skin",
    teraType: null,
    moves: ["Earthquake"],
    kos: [],
    mask,
    speedStat: 300,
  });

  it("lists a lone sweeper as a solo threat but never as a loadout", () => {
    const sets = [[fake(0, 0b011111)], [fake(1, 0b000011)], [fake(2, 0b001100)], [fake(3, 0b110000)]];
    const r = searchLoadouts(sets, 6, 4, 5, 2);
    expect(r.soloThreats.map((s) => s.rosterIndex)).toEqual([0]);
    expect(r.loadouts.every((l) => l.sets.length >= 2)).toBe(true);
  });

  it("scores how much coverage survives losing a member", () => {
    // 0 and 1 each cover four alone; 2 covers a different pair
    const sets = [[fake(0, 0b001111)], [fake(1, 0b001111)], [fake(2, 0b110000)]];
    const r = searchLoadouts(sets, 6, 4, 5, 2);
    const twins = r.loadouts.find((l) => l.sets.every((s) => s.rosterIndex < 2))!;
    expect(twins.resilience).toBe(4);
    expect(twins.pointsOfFailure).toEqual([]);
    const lopsided = r.loadouts.find((l) => l.sets.some((s) => s.rosterIndex === 2) && l.sets.length === 2)!;
    expect(lopsided.resilience).toBe(2);
    expect(lopsided.pointsOfFailure).toHaveLength(1);
  });

  it("reserves a slot for a bigger core that survives a loss when the minimum can't", () => {
    // Any pair reaches 4 but drops to 2 after a loss; the trio keeps 4
    const sets = [[fake(0, 0b000011)], [fake(1, 0b001100)], [fake(2, 0b110000)]];
    const r = searchLoadouts(sets, 6, 4, 5, 2);
    expect(r.minMons).toBe(2);
    const extra = r.loadouts.filter((l) => l.extraMon);
    expect(extra.length).toBeGreaterThan(0);
    expect(extra[0].resilience).toBeGreaterThan(Math.max(...r.loadouts.filter((l) => !l.extraMon).map((l) => l.resilience)));
  });

  it("honours the Choice cap", () => {
    const sets = [[fake(0, 0b000111, "Choice Band")], [fake(1, 0b111000, "Choice Specs")], [fake(2, 0b111000, "Life Orb")]];
    const r = searchLoadouts(sets, 6, 6, 5, 2, 1);
    expect(r.loadouts.length).toBeGreaterThan(0);
    for (const l of r.loadouts) expect(l.sets.filter((s) => s.item.startsWith("Choice")).length).toBeLessThanOrEqual(1);
  });

  it("falls back to the fewest attackers reaching the best coverage when the goal is out of reach", () => {
    const sets = [[fake(0, 0b000011)], [fake(1, 0b000100)], [fake(2, 0b000001)]];
    const r = searchLoadouts(sets, 6, 4, 5, 2);
    expect(r.bestCoverage).toBe(3);
    expect(r.minMons).toBe(2);
    expect(r.loadouts.length).toBeGreaterThan(0);
    expect(r.loadouts.every((l) => l.extraMon || l.sets.length === 2)).toBe(true);
  });
});
