import { useState } from "react";
import {
  useLeagueState,
  useLeagueDispatch,
  useSelectedPokemon,
} from "@/context/league-context";
import { LeagueSection } from "./LeagueSection";
import { SidePanel } from "./SidePanel";

export function TeamsPage() {
  const state = useLeagueState();
  const dispatch = useLeagueDispatch();
  const selected = useSelectedPokemon();

  const [showCreateLeague, setShowCreateLeague] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState("");
  const [newLeagueSize, setNewLeagueSize] = useState(10);

  function createLeague() {
    if (!newLeagueName.trim()) return;
    dispatch({
      type: "CREATE_LEAGUE",
      name: newLeagueName.trim(),
      teamSize: newLeagueSize,
    });
    setNewLeagueName("");
    setNewLeagueSize(10);
    setShowCreateLeague(false);
  }

  return (
    <div className="flex gap-6 h-full">
      <div className={`flex-1 min-w-0 ${selected ? "max-w-[calc(100%-420px)]" : ""}`}>
        {/* League sections */}
        {state.leagues.length === 0 && !showCreateLeague ? (
          <div className="glass rounded-card p-8 text-center">
            <h2 className="font-display text-lg font-semibold mb-2 text-warm-100">
              No leagues yet
            </h2>
            <p className="text-text-secondary text-sm mb-4">
              Create your first draft league to start building teams.
            </p>
            <button
              onClick={() => setShowCreateLeague(true)}
              className="gradient-accent text-purple-950 font-body font-semibold
                         px-5 py-2.5 rounded-pill hover:opacity-90 transition-opacity cursor-pointer"
            >
              Create League
            </button>
          </div>
        ) : (
          <>
            {state.leagues.map((league) => (
              <LeagueSection key={league.id} league={league} />
            ))}
          </>
        )}

        {/* Create league form */}
        {showCreateLeague ? (
          <div className="glass rounded-card p-4 mt-4">
            <h3 className="font-body font-semibold text-sm text-text-primary mb-3">
              New League
            </h3>
            <div className="flex items-center gap-3">
              <input
                autoFocus
                value={newLeagueName}
                onChange={(e) => setNewLeagueName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createLeague()}
                placeholder="League name..."
                className="flex-1 bg-transparent text-sm text-text-primary
                           placeholder:text-text-muted focus:outline-none font-body
                           border-b border-text-muted focus:border-accent pb-1"
              />
              <label className="flex items-center gap-1 text-[11px] font-mono text-text-muted shrink-0">
                Size:
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={newLeagueSize}
                  onChange={(e) => setNewLeagueSize(Number(e.target.value))}
                  className="w-12 bg-transparent text-sm text-text-primary
                             focus:outline-none font-mono text-center
                             border-b border-text-muted focus:border-accent"
                />
              </label>
              <button
                onClick={createLeague}
                className="text-xs font-mono text-accent hover:text-teal-300 transition-colors cursor-pointer"
              >
                Create
              </button>
              <button
                onClick={() => setShowCreateLeague(false)}
                className="text-xs font-mono text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          state.leagues.length > 0 && (
            <button
              onClick={() => setShowCreateLeague(true)}
              className="mt-2 text-xs font-mono text-text-muted hover:text-text-secondary
                         transition-colors cursor-pointer"
            >
              + Create League
            </button>
          )
        )}
      </div>

      {/* Side panel */}
      {selected && (
        <SidePanel
          pokemon={selected.pokemon}
          team={selected.team}
          league={selected.league}
          onClose={() => dispatch({ type: "CLEAR_SELECTION" })}
        />
      )}
    </div>
  );
}
