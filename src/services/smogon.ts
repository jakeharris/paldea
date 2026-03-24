import { Dex } from "@pkmn/dex";
import { Generations } from "@pkmn/data";
import type { CompetitiveData } from "./types";

/** Shared Generations instance backed by @pkmn/dex */
export const generations = new Generations(Dex);

/**
 * Fetch Smogon analysis data for a Pokemon in a given generation.
 */
export async function fetchCompetitiveData(
  _pokemonName: string,
  _gen?: number,
): Promise<CompetitiveData> {
  // TODO: use @pkmn/smogon to build CompetitiveData
  throw new Error("Not implemented");
}

/**
 * Fetch Smogon usage statistics for a Pokemon in a given format.
 */
export async function fetchUsageStats(
  _pokemonName: string,
  _format?: string,
): Promise<number | null> {
  // TODO: use @pkmn/smogon to get usage percentage
  throw new Error("Not implemented");
}

/**
 * Get generation-specific data (type chart, available moves, etc.)
 */
export function getGeneration(gen: number) {
  return generations.get(gen);
}
