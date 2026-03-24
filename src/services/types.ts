/** Base stat distribution */
export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

/** Ability slots for a Pokemon */
export interface Abilities {
  primary: string;
  secondary: string | null;
  hidden: string | null;
}

/** Core Pokemon representation for draft league context */
export interface DraftPokemon {
  id: number;
  name: string;
  types: [string] | [string, string];
  baseStats: BaseStats;
  abilities: Abilities;
  sprite: string;
  icon: string;
  isTeraCaptain: boolean;
}

/** A player's drafted team within a league */
export interface DraftTeam {
  id: string;
  playerName: string;
  pokemon: DraftPokemon[];
  isMyTeam: boolean;
}

/** League configuration */
export interface League {
  id: string;
  name: string;
  generation: number;
  format: string;
  teamSize: number;
  teams: DraftTeam[];
}

/** A single item in the team composition checklist */
export interface ChecklistItem {
  id: string;
  label: string;
  met: boolean;
  contributors: string[];
}
