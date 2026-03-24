import { Dex } from "@pkmn/dex";
import { Generations, type Specie } from "@pkmn/data";
import type { DraftPokemon, BaseStats, Abilities } from "./types";

export const generations = new Generations(Dex);

/** Minimal info for autocomplete results */
export interface SpeciesEntry {
  name: string;
  id: string;
  num: number;
  types: [string] | [string, string];
}

// Cache per generation
const speciesListCache = new Map<number, SpeciesEntry[]>();

/** Get all species for a generation, cached. */
export function getSpeciesList(gen: number = 9): SpeciesEntry[] {
  const cached = speciesListCache.get(gen);
  if (cached) return cached;

  // Use the full National Dex — draft leagues allow all real Pokemon
  const excluded = new Set(["CAP", "Custom"]);
  const list: SpeciesEntry[] = [];
  for (const species of Dex.species.all()) {
    if (!species.exists) continue;
    if (species.isNonstandard && excluded.has(species.isNonstandard)) continue;
    list.push({
      name: species.name,
      id: species.id as string,
      num: species.num,
      types: species.types as [string] | [string, string],
    });
  }
  // Sort alphabetically
  list.sort((a, b) => a.name.localeCompare(b.name));
  speciesListCache.set(gen, list);
  return list;
}

/** Get full species data for a Pokemon by name */
/** Get species data — tries gen-scoped first, falls back to raw Dex for Past/Future mons */
export function getSpecies(name: string, gen: number = 9): Specie | undefined {
  const generation = generations.get(gen);
  return generation.species.get(name);
}

/** Get species from raw Dex (works for all Pokemon including Past/Future) */
export function getDexSpecies(name: string) {
  const species = Dex.species.get(name);
  return species.exists ? species : undefined;
}

/** Build ability info from species abilities object */
function buildAbilities(abilities: { 0: string; 1?: string; H?: string }): Abilities {
  return {
    primary: abilities[0],
    secondary: abilities[1] || null,
    hidden: abilities["H"] || null,
  };
}

/** Convert a species name to a Showdown-compatible ID (preserves form hyphens) */
function toShowdownId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, "");
}

/** Construct Showdown dex sprite URL (120x120 PNG, always available) */
export function getSpriteUrl(name: string): string {
  const id = toShowdownId(name);
  return `https://play.pokemonshowdown.com/sprites/home/${id}.png`;
}

/** Construct Showdown animated sprite URL (GIF, may not exist for newer Pokemon) */
export function getAnimatedSpriteUrl(name: string): string {
  const id = toShowdownId(name);
  return `https://play.pokemonshowdown.com/sprites/ani/${id}.gif`;
}

/** Construct Showdown icon URL */
export function getIconUrl(name: string): string {
  const id = toShowdownId(name);
  return `https://play.pokemonshowdown.com/sprites/dex/${id}.png`;
}

/** Common shape between @pkmn/data Specie and raw Dex Species */
interface SpeciesLike {
  num: number;
  name: string;
  types: readonly string[];
  baseStats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  abilities: { 0: string; 1?: string; H?: string };
}

/** Transform a species into our DraftPokemon shape */
export function toDraftPokemon(species: SpeciesLike): DraftPokemon {
  const stats = species.baseStats;
  const baseStats: BaseStats = {
    hp: stats.hp,
    atk: stats.atk,
    def: stats.def,
    spa: stats.spa,
    spd: stats.spd,
    spe: stats.spe,
  };
  return {
    id: species.num,
    name: species.name,
    types: species.types as [string] | [string, string],
    baseStats,
    abilities: buildAbilities(species.abilities),
    sprite: getSpriteUrl(species.name),
    icon: getIconUrl(species.name),
    isTeraCaptain: false,
  };
}

/** Check if a Pokemon can learn a move (async - learnsets are lazy-loaded) */
export async function canLearn(
  name: string,
  move: string,
  gen: number = 9,
): Promise<boolean> {
  const generation = generations.get(gen);
  return generation.learnsets.canLearn(name, move);
}

/** Get full learnable moveset for a Pokemon */
export async function getLearnable(
  name: string,
  gen: number = 9,
): Promise<Record<string, string[]> | undefined> {
  const generation = generations.get(gen);
  return generation.learnsets.learnable(name);
}
