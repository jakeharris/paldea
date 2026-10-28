import type { League } from "@/services/types";
import { getDexSpecies, toDraftPokemon } from "@/services/pokemon-data";
import fixture from "./leagues.json";

/** Compact fixture shape: species names only; stats, types and sprites come from the dex */
interface FixtureLeague extends Omit<League, "teams"> {
  teams: {
    id: string;
    playerName: string;
    isMyTeam?: boolean;
    pokemon: string[];
    teraCaptains?: string[];
  }[];
}

/** Expand the fixture into full League objects. Throws on an unknown species name. */
export function buildSeedLeagues(leagues: FixtureLeague[] = fixture): League[] {
  return leagues.map((league) => ({
    ...league,
    teams: league.teams.map((team) => ({
      id: team.id,
      playerName: team.playerName,
      isMyTeam: team.isMyTeam ?? false,
      pokemon: team.pokemon.map((name) => {
        const species = getDexSpecies(name);
        if (!species) throw new Error(`Seed fixture: unknown species "${name}"`);
        return { ...toDraftPokemon(species), isTeraCaptain: team.teraCaptains?.includes(name) ?? false };
      }),
    })),
  }));
}
