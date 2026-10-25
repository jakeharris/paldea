import { calculate, Pokemon, Move, Field, Side } from "@smogon/calc/dist/adaptable";
import type * as CalcData from "@smogon/calc/dist/data/interface";
import type { Move as PkmnMove } from "@pkmn/data";
import { generations } from "./pokemon-data";

/**
 * Thin wrapper around @smogon/calc — the same engine that powers
 * calc.pokemonshowdown.com — fed with our @pkmn/data generations so the
 * calc's own bundled dex never ships.
 */

export type WeatherOption = "" | "Sun" | "Rain" | "Sand" | "Snow";
export type TerrainOption = "" | "Electric" | "Grassy" | "Psychic" | "Misty";

export type StatSpread = { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };

/**
 * Which defender builds a KO has to hold against:
 *  - standard: their Smogon set (or 252 HP neutral if Smogon has none)
 *  - counter:  re-spread to wall this hit — 252 HP / 252+ Def or SpD
 *  - worst:    both; the KO only counts if it beats each
 */
export type DefenderMode = "worst" | "standard" | "counter";

export const DEFENDER_MODES: Record<DefenderMode, { label: string; detail: string }> = {
  worst: { label: "Worst of both", detail: "KO must beat their Smogon set and a build made to counter you" },
  standard: { label: "Smogon set", detail: "Their standard Smogon set (252 HP neutral if none)" },
  counter: { label: "Counter build", detail: "252 HP / 252+ in the defense your hit targets" },
};

/** 252 HP / 252 in the hit defense with a + nature for it */
export function counterSpread(category: "Physical" | "Special"): { nature: CalcData.NatureName; evs: StatSpread } {
  return category === "Physical"
    ? { nature: "Bold", evs: { hp: 252, atk: 0, def: 252, spa: 0, spd: 4, spe: 0 } }
    : { nature: "Calm", evs: { hp: 252, atk: 0, def: 4, spa: 0, spd: 252, spe: 0 } };
}

export type AttackNature = "Adamant" | "Jolly" | "Modest" | "Timid";

export const ATTACK_NATURES: Record<AttackNature, { focus: "atk" | "spa"; plusSpe: boolean }> = {
  Adamant: { focus: "atk", plusSpe: false },
  Jolly: { focus: "atk", plusSpe: true },
  Modest: { focus: "spa", plusSpe: false },
  Timid: { focus: "spa", plusSpe: true },
};

export interface FieldOptions {
  weather: WeatherOption;
  terrain: TerrainOption;
  stealthRock: boolean;
}

export interface AttackerConfig {
  species: string;
  nature: AttackNature;
  ability: string;
  item: string;
  teraType?: string;
  /** EVs in the nature's focus stat (defaults to 252) */
  focusEvs?: number;
  level: number;
}

export interface DefenderConfig {
  species: string;
  ability: string;
  item: string;
  nature: string;
  evs: Partial<StatSpread>;
  level: number;
}

export interface DamageOutcome {
  /** Damage as % of defender max HP */
  minPercent: number;
  maxPercent: number;
  /** Chance (0–1) the hit KOs from full HP, after hazards when enabled */
  ohkoChance: number;
  desc: string;
}

/** Abilities that let a hit through Sturdy / Disguise / Ice Face */
const MOLD_BREAKERS = new Set(["Mold Breaker", "Teravolt", "Turboblaze"]);

const WEATHER_SETTERS: Record<string, CalcData.Weather> = {
  Drought: "Sun",
  "Orichalcum Pulse": "Sun",
  Drizzle: "Rain",
  "Sand Stream": "Sand",
  "Snow Warning": "Snow",
  "Desolate Land": "Harsh Sunshine",
  "Primordial Sea": "Heavy Rain",
};

const TERRAIN_SETTERS: Record<string, CalcData.Terrain> = {
  "Electric Surge": "Electric",
  "Hadron Engine": "Electric",
  "Grassy Surge": "Grassy",
  "Psychic Surge": "Psychic",
  "Misty Surge": "Misty",
};

function calcGen(gen: number): CalcData.Generation {
  // @pkmn/data's Generation satisfies the calc's adaptable interface
  return generations.get(gen) as unknown as CalcData.Generation;
}

export function buildAttacker(gen: number, cfg: AttackerConfig): Pokemon {
  const { focus } = ATTACK_NATURES[cfg.nature];
  const focusEvs = cfg.focusEvs ?? 252;
  return new Pokemon(calcGen(gen), cfg.species, {
    level: cfg.level,
    nature: cfg.nature,
    ability: cfg.ability as CalcData.AbilityName,
    item: (cfg.item || undefined) as CalcData.ItemName | undefined,
    teraType: cfg.teraType as CalcData.TypeName | undefined,
    // Booster Energy activates Protosynthesis/Quark Drive on the highest stat
    boostedStat: cfg.item === "Booster Energy" ? "auto" : undefined,
    evs: { hp: 4, [focus]: focusEvs, spe: 252 },
  });
}

export function buildDefender(gen: number, cfg: DefenderConfig): Pokemon {
  return new Pokemon(calcGen(gen), cfg.species, {
    level: cfg.level,
    nature: cfg.nature as CalcData.NatureName,
    ability: cfg.ability as CalcData.AbilityName,
    item: (cfg.item || undefined) as CalcData.ItemName | undefined,
    boostedStat: cfg.item === "Booster Energy" ? "auto" : undefined,
    evs: cfg.evs,
  });
}

export function buildField(attackerAbility: string, defenderAbility: string, opts: FieldOptions): Field {
  return new Field({
    gameType: "Singles",
    weather: (opts.weather || WEATHER_SETTERS[attackerAbility]) || undefined,
    terrain: (opts.terrain || TERRAIN_SETTERS[attackerAbility]) || undefined,
    isSwordOfRuin: attackerAbility === "Sword of Ruin",
    isBeadsOfRuin: attackerAbility === "Beads of Ruin",
    isTabletsOfRuin: defenderAbility === "Tablets of Ruin",
    isVesselOfRuin: defenderAbility === "Vessel of Ruin",
    attackerSide: new Side(),
    defenderSide: new Side({ isSR: opts.stealthRock }),
  });
}

/** Field weather that will actually be active for this attacker */
export function effectiveWeather(attackerAbility: string, opts: FieldOptions): string {
  return opts.weather || WEATHER_SETTERS[attackerAbility] || "";
}

/** True when the defender's ability makes a full-HP OHKO impossible */
function blocksOhko(attackerAbility: string, defenderAbility: string, move: PkmnMove): boolean {
  if (MOLD_BREAKERS.has(attackerAbility)) return false;
  if (defenderAbility === "Sturdy") return !move.multihit;
  if (defenderAbility === "Disguise") return true;
  if (defenderAbility === "Ice Face") return move.category === "Physical";
  return false;
}

export function runCalc(
  gen: number,
  attacker: Pokemon,
  defender: Pokemon,
  move: PkmnMove,
  field: FieldOptions,
): DamageOutcome {
  const g = calcGen(gen);
  const attackerAbility = attacker.ability ?? "";
  const defenderAbility = defender.ability ?? "";
  const calcField = buildField(attackerAbility, defenderAbility, field);
  const result = calculate(g, attacker, defender, new Move(g, move.name, { ability: attacker.ability, item: attacker.item }), calcField);
  const hp = defender.maxHP();
  const [min, max] = result.range();

  let ohkoChance = 0;
  // Stealth Rock chips at most 50%, so only bother with kochance when a KO is possible
  const reachable = field.stealthRock ? max >= hp / 2 : max >= hp;
  if (reachable && !blocksOhko(attackerAbility, defenderAbility, move)) {
    const ko = result.kochance(false);
    ohkoChance = ko.n === 1 ? ko.chance ?? 0 : 0;
  }

  let desc = "";
  try {
    desc = result.fullDesc("%", false);
  } catch {
    desc = `${attacker.name} ${move.name} vs. ${defender.name}`;
  }

  return {
    minPercent: (min / hp) * 100,
    maxPercent: (max / hp) * 100,
    ohkoChance,
    desc,
  };
}
