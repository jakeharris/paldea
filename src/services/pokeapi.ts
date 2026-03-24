import type { DraftPokemon } from "./types";

const BASE_URL = "https://pokeapi.co/api/v2";

/**
 * Fetch a Pokemon by name or ID from PokeAPI.
 * Results are cached by the service worker (StaleWhileRevalidate).
 */
export async function fetchPokemon(
  _nameOrId: string | number,
): Promise<DraftPokemon> {
  // TODO: implement fetch + transform to DraftPokemon
  void BASE_URL;
  throw new Error("Not implemented");
}

/**
 * Fetch a page of Pokemon from the PokeAPI pokedex endpoint.
 */
export async function fetchPokemonList(
  _offset?: number,
  _limit?: number,
): Promise<{ name: string; url: string }[]> {
  // TODO: implement paginated list fetch
  throw new Error("Not implemented");
}

/**
 * Fetch the full moveset for a Pokemon by generation.
 */
export async function fetchMovePool(
  _pokemonId: number,
  _generation?: number,
): Promise<string[]> {
  // TODO: implement move pool fetch filtered by generation
  throw new Error("Not implemented");
}
