import { useState } from "react";
import { useLeagueDispatch } from "@/context/league-context";
import { TeamCard } from "./TeamCard";
import type { League } from "@/services/types";

interface LeagueSectionProps {
  league: League;
}

export function LeagueSection({ league }: LeagueSectionProps) {
  const dispatch = useLeagueDispatch();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(league.name);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [isMyTeam, setIsMyTeam] = useState(false);

  function saveName() {
    if (editName.trim()) {
      dispatch({ type: "RENAME_LEAGUE", leagueId: league.id, name: editName.trim() });
    }
    setIsEditing(false);
  }

  function addTeam() {
    if (!newTeamName.trim()) return;
    dispatch({
      type: "ADD_TEAM",
      leagueId: league.id,
      playerName: newTeamName.trim(),
      isMyTeam,
    });
    setNewTeamName("");
    setIsMyTeam(false);
    setShowAddTeam(false);
  }

  return (
    <section className="mb-6">
      <div className="flex items-center gap-3 mb-3">
        {isEditing ? (
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
            className="bg-transparent border-b border-text-muted text-text-secondary
                       font-display text-sm font-medium focus:outline-none focus:border-accent
                       px-0 py-0.5"
          />
        ) : (
          <button
            onClick={() => {
              setEditName(league.name);
              setIsEditing(true);
            }}
            className="font-display text-sm font-medium text-text-muted
                       hover:text-text-secondary transition-colors"
          >
            {league.name}
          </button>
        )}
        <span className="text-[10px] font-mono text-text-muted">
          Gen {league.generation} · {league.teamSize} slots
        </span>
        <button
          onClick={() => dispatch({ type: "DELETE_LEAGUE", leagueId: league.id })}
          className="text-text-muted hover:text-red-400 transition-colors text-xs ml-auto"
          title="Delete league"
        >
          Delete
        </button>
      </div>

      <div className="flex flex-col gap-4 ml-0">
        {league.teams.map((team) => (
          <TeamCard
            key={team.id}
            leagueId={league.id}
            team={team}
            teamSize={league.teamSize}
          />
        ))}
      </div>

      {showAddTeam ? (
        <div className="mt-3 glass rounded-card p-3 flex items-center gap-3">
          <input
            autoFocus
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTeam()}
            placeholder="Player name..."
            className="flex-1 bg-transparent text-sm text-text-primary
                       placeholder:text-text-muted focus:outline-none font-body"
          />
          <label className="flex items-center gap-1 text-[11px] font-mono text-text-muted shrink-0">
            <input
              type="checkbox"
              checked={isMyTeam}
              onChange={(e) => setIsMyTeam(e.target.checked)}
              className="accent-accent w-3.5 h-3.5"
            />
            My team
          </label>
          <button
            onClick={addTeam}
            className="text-xs font-mono text-accent hover:text-teal-300 transition-colors"
          >
            Add
          </button>
          <button
            onClick={() => setShowAddTeam(false)}
            className="text-xs font-mono text-text-muted hover:text-text-secondary transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowAddTeam(true)}
          className="mt-3 text-xs font-mono text-text-muted hover:text-text-secondary
                     transition-colors"
        >
          + Add Team
        </button>
      )}
    </section>
  );
}
