/** Core Pokemon representation for draft league context */
export interface DraftPokemon {
  id: number;
  name: string;
  types: [string] | [string, string];
  baseStats: BaseStats;
  abilities: string[];
  sprite: string;
}

export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

/** A player's drafted team */
export interface DraftTeam {
  id: string;
  playerName: string;
  pokemon: DraftPokemon[];
}

/** League configuration */
export interface League {
  id: string;
  name: string;
  generation: number;
  format: string;
  teams: DraftTeam[];
  draftPool: DraftPokemon[];
}

/** Smogon competitive data for a Pokemon */
export interface CompetitiveData {
  pokemon: string;
  tier: string;
  sets: SmogonSet[];
  usage: number | null;
}

export interface SmogonSet {
  name: string;
  moves: string[];
  ability: string;
  item: string;
  nature: string;
  evs: Partial<BaseStats>;
}
