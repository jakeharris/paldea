import { useState, useRef, useEffect } from "react";
import { useLeagueDispatch } from "@/context/league-context";
import { PokemonRow } from "./PokemonRow";
import { PokemonSearch, type PokemonSearchHandle } from "./PokemonSearch";
import type { DraftTeam, DraftPokemon } from "@/services/types";

interface TeamCardProps {
  leagueId: string;
  team: DraftTeam;
  teamSize: number;
}

export function TeamCard({ leagueId, team, teamSize }: TeamCardProps) {
  const dispatch = useLeagueDispatch();
  const searchRef = useRef<PokemonSearchHandle>(null);
  const [showSearch, setShowSearch] = useState(false);
  const isFull = team.pokemon.length >= teamSize;

  useEffect(() => {
    if (showSearch) searchRef.current?.focus();
  }, [showSearch]);

  function handleAdd(pokemon: DraftPokemon) {
    dispatch({ type: "ADD_POKEMON", leagueId, teamId: team.id, pokemon });
    dispatch({
      type: "SELECT_POKEMON",
      leagueId,
      teamId: team.id,
      pokemonIndex: team.pokemon.length,
    });
  }

  return (
    <div className={`glass rounded-card p-4 relative ${showSearch ? "z-10" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h4 className="font-body font-semibold text-sm text-text-primary">
            {team.playerName}
          </h4>
          {team.isMyTeam && (
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded
                           gradient-accent text-purple-950 leading-none">
              MY TEAM
            </span>
          )}
          <span className="text-[11px] font-mono text-text-muted">
            {team.pokemon.length}/{teamSize}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isFull && (
            <button
              onClick={() => setShowSearch((s) => !s)}
              className={`text-[11px] font-mono px-2 py-1 rounded-pill transition-colors ${
                showSearch
                  ? "bg-accent/20 text-accent"
                  : "text-text-muted hover:text-text-secondary hover:bg-surface-raised"
              }`}
            >
              {showSearch ? "Done" : "+ Add"}
            </button>
          )}
          <button
            onClick={() =>
              dispatch({ type: "REMOVE_TEAM", leagueId, teamId: team.id })
            }
            className="text-text-muted hover:text-red-400 transition-colors text-sm px-1"
            title="Remove team"
          >
            ×
          </button>
        </div>
      </div>

      {showSearch && !isFull && (
        <div className="mb-3">
          <PokemonSearch ref={searchRef} onSelect={handleAdd} />
        </div>
      )}

      {team.pokemon.length === 0 && !showSearch ? (
        <p className="text-text-muted text-xs font-mono py-4 text-center">
          No Pokemon yet — click "+ Add" to search
        </p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {team.pokemon.map((p, i) => (
            <PokemonRow
              key={`${p.id}-${i}`}
              pokemon={p}
              onClick={() =>
                dispatch({
                  type: "SELECT_POKEMON",
                  leagueId,
                  teamId: team.id,
                  pokemonIndex: i,
                })
              }
              onToggleTera={() =>
                dispatch({
                  type: "TOGGLE_TERA_CAPTAIN",
                  leagueId,
                  teamId: team.id,
                  pokemonIndex: i,
                })
              }
              onRemove={() =>
                dispatch({
                  type: "REMOVE_POKEMON",
                  leagueId,
                  teamId: team.id,
                  pokemonIndex: i,
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
