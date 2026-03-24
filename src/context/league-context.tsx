import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  type ReactNode,
  type Dispatch,
} from "react";
import type { League, DraftTeam, DraftPokemon } from "@/services/types";
import { getIconUrl, getSpriteUrl } from "@/services/pokemon-data";

// ── State ──

export interface LeagueState {
  leagues: League[];
  selectedLeagueId: string | null;
  selectedTeamId: string | null;
  selectedPokemonIndex: number | null;
}

const initialState: LeagueState = {
  leagues: [],
  selectedLeagueId: null,
  selectedTeamId: null,
  selectedPokemonIndex: null,
};

// ── Actions ──

type Action =
  | { type: "HYDRATE"; leagues: League[] }
  | { type: "CREATE_LEAGUE"; name: string; generation?: number; teamSize?: number }
  | { type: "DELETE_LEAGUE"; leagueId: string }
  | { type: "RENAME_LEAGUE"; leagueId: string; name: string }
  | { type: "ADD_TEAM"; leagueId: string; playerName: string; isMyTeam: boolean }
  | { type: "REMOVE_TEAM"; leagueId: string; teamId: string }
  | { type: "ADD_POKEMON"; leagueId: string; teamId: string; pokemon: DraftPokemon }
  | { type: "REMOVE_POKEMON"; leagueId: string; teamId: string; pokemonIndex: number }
  | { type: "TOGGLE_TERA_CAPTAIN"; leagueId: string; teamId: string; pokemonIndex: number }
  | { type: "SELECT_POKEMON"; leagueId: string; teamId: string; pokemonIndex: number }
  | { type: "CLEAR_SELECTION" }
  | { type: "SET_ACTIVE_TEAM"; leagueId: string; teamId: string };

// ── Helpers ──

let nextId = 0;
function uid() {
  return `${Date.now()}-${nextId++}`;
}

function mapLeague(
  state: LeagueState,
  leagueId: string,
  fn: (league: League) => League,
): LeagueState {
  return {
    ...state,
    leagues: state.leagues.map((l) => (l.id === leagueId ? fn(l) : l)),
  };
}

function mapTeam(
  league: League,
  teamId: string,
  fn: (team: DraftTeam) => DraftTeam,
): League {
  return {
    ...league,
    teams: league.teams.map((t) => (t.id === teamId ? fn(t) : t)),
  };
}

// ── Reducer ──

function leagueReducer(state: LeagueState, action: Action): LeagueState {
  switch (action.type) {
    case "HYDRATE":
      return { ...state, leagues: action.leagues };

    case "CREATE_LEAGUE": {
      const league: League = {
        id: uid(),
        name: action.name,
        generation: action.generation ?? 9,
        format: "draft",
        teamSize: action.teamSize ?? 10,
        teams: [],
      };
      return { ...state, leagues: [...state.leagues, league] };
    }

    case "DELETE_LEAGUE":
      return {
        ...state,
        leagues: state.leagues.filter((l) => l.id !== action.leagueId),
        ...(state.selectedLeagueId === action.leagueId
          ? { selectedLeagueId: null, selectedTeamId: null, selectedPokemonIndex: null }
          : {}),
      };

    case "RENAME_LEAGUE":
      return mapLeague(state, action.leagueId, (l) => ({
        ...l,
        name: action.name,
      }));

    case "ADD_TEAM": {
      const team: DraftTeam = {
        id: uid(),
        playerName: action.playerName,
        pokemon: [],
        isMyTeam: action.isMyTeam,
      };
      return mapLeague(state, action.leagueId, (l) => ({
        ...l,
        teams: [...l.teams, team],
      }));
    }

    case "REMOVE_TEAM":
      return mapLeague(state, action.leagueId, (l) => ({
        ...l,
        teams: l.teams.filter((t) => t.id !== action.teamId),
      }));

    case "ADD_POKEMON":
      return mapLeague(state, action.leagueId, (l) =>
        mapTeam(l, action.teamId, (t) => ({
          ...t,
          pokemon: [...t.pokemon, action.pokemon],
        })),
      );

    case "REMOVE_POKEMON":
      return mapLeague(state, action.leagueId, (l) =>
        mapTeam(l, action.teamId, (t) => ({
          ...t,
          pokemon: t.pokemon.filter((_, i) => i !== action.pokemonIndex),
        })),
      );

    case "TOGGLE_TERA_CAPTAIN":
      return mapLeague(state, action.leagueId, (l) =>
        mapTeam(l, action.teamId, (t) => ({
          ...t,
          pokemon: t.pokemon.map((p, i) =>
            i === action.pokemonIndex
              ? { ...p, isTeraCaptain: !p.isTeraCaptain }
              : p,
          ),
        })),
      );

    case "SELECT_POKEMON":
      return {
        ...state,
        selectedLeagueId: action.leagueId,
        selectedTeamId: action.teamId,
        selectedPokemonIndex: action.pokemonIndex,
      };

    case "CLEAR_SELECTION":
      return {
        ...state,
        selectedPokemonIndex: null,
      };

    case "SET_ACTIVE_TEAM":
      return {
        ...state,
        selectedLeagueId: action.leagueId,
        selectedTeamId: action.teamId,
      };

    default:
      return state;
  }
}

// ── Context ──

const STORAGE_KEY = "paldea-leagues";

const LeagueStateContext = createContext<LeagueState>(initialState);
const LeagueDispatchContext = createContext<Dispatch<Action>>(() => {});

export function LeagueProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(leagueReducer, initialState, (init) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const leagues = JSON.parse(stored) as League[];
        // Re-derive icon/sprite URLs so they always use the current format.
        // Done in a separate try so a refresh failure never loses the stored data.
        try {
          for (const league of leagues) {
            for (const team of league.teams) {
              for (const mon of team.pokemon) {
                mon.icon = getIconUrl(mon.name);
                mon.sprite = getSpriteUrl(mon.name);
              }
            }
          }
        } catch {
          // URL refresh failed — proceed with stored URLs rather than losing data
        }
        return { ...init, leagues };
      }
    } catch {
      // ignore corrupt data
    }
    return init;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.leagues));
  }, [state.leagues]);

  return (
    <LeagueStateContext value={state}>
      <LeagueDispatchContext value={dispatch}>
        {children}
      </LeagueDispatchContext>
    </LeagueStateContext>
  );
}

export function useLeagueState() {
  return useContext(LeagueStateContext);
}

export function useLeagueDispatch() {
  return useContext(LeagueDispatchContext);
}

/** Convenience: get the currently selected pokemon and its team/league */
export function useSelectedPokemon() {
  const state = useLeagueState();
  if (
    state.selectedLeagueId == null ||
    state.selectedTeamId == null ||
    state.selectedPokemonIndex == null
  )
    return null;

  const league = state.leagues.find((l) => l.id === state.selectedLeagueId);
  if (!league) return null;

  const team = league.teams.find((t) => t.id === state.selectedTeamId);
  if (!team) return null;

  const pokemon = team.pokemon[state.selectedPokemonIndex];
  if (!pokemon) return null;

  return { league, team, pokemon, index: state.selectedPokemonIndex };
}
