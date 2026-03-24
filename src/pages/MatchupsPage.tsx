import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router";
import { useLeagueState } from "@/context/league-context";
import { MatchupHero } from "@/components/matchups/MatchupHero";
import { DefensiveTypeChart } from "@/components/matchups/DefensiveTypeChart";
import { SpeedTierTool } from "@/components/matchups/SpeedTierTool";
import { MoveCategoryPanel } from "@/components/matchups/MoveCategoryPanel";
import { CoveragePlanner } from "@/components/matchups/CoveragePlanner";
import { useMatchupMoves } from "@/hooks/use-matchup-moves";

export function MatchupsPage() {
  const state = useLeagueState();

  const [opponentTeamId, setOpponentTeamId] = useState<string | null>(null);
  const [excludedMyIds, setExcludedMyIds] = useState<Set<number>>(new Set());
  const [excludedOppIds, setExcludedOppIds] = useState<Set<number>>(new Set());
  const [coverageTypes, setCoverageTypes] = useState<Set<string>>(new Set());

  const league = useMemo(
    () =>
      state.leagues.find((l) => l.id === state.selectedLeagueId) ??
      state.leagues[0] ??
      null,
    [state.leagues, state.selectedLeagueId],
  );

  const myTeam = useMemo(
    () => league?.teams.find((t) => t.isMyTeam) ?? null,
    [league],
  );

  const oppTeam = useMemo(
    () => (opponentTeamId ? league?.teams.find((t) => t.id === opponentTeamId) ?? null : null),
    [league, opponentTeamId],
  );

  const activeMyPokemon = useMemo(
    () => myTeam?.pokemon.filter((_, i) => !excludedMyIds.has(i)) ?? [],
    [myTeam, excludedMyIds],
  );

  const activeOppPokemon = useMemo(
    () => oppTeam?.pokemon.filter((_, i) => !excludedOppIds.has(i)) ?? [],
    [oppTeam, excludedOppIds],
  );

  // Reset exclusions when opponent changes
  useEffect(() => {
    setExcludedMyIds(new Set());
    setExcludedOppIds(new Set());
  }, [opponentTeamId]);

  const { myCategories, oppCategories, loading: movesLoading } = useMatchupMoves(
    activeMyPokemon,
    activeOppPokemon,
    league?.generation ?? 9,
  );

  function toggleMyExclusion(index: number) {
    setExcludedMyIds((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleOppExclusion(index: number) {
    setExcludedOppIds((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleCoverageType(type: string) {
    setCoverageTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  if (!league || !myTeam) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="font-body text-text-muted text-center">
          No team set up yet. Add your team in the Teams section first.
        </p>
        <Link
          to="/teams"
          className="gradient-accent text-purple-950 font-body font-semibold px-5 py-2.5 rounded-pill hover:opacity-90 transition-opacity"
        >
          Go to Teams
        </Link>
      </div>
    );
  }

  const opponents = league.teams.filter((t) => !t.isMyTeam);

  return (
    <div className="flex flex-col gap-6">
      {/* Opponent selector */}
      <div className="glass rounded-card p-4 flex items-center gap-4">
        <label className="font-mono text-sm text-text-secondary shrink-0">
          Opponent
        </label>
        <select
          value={opponentTeamId ?? ""}
          onChange={(e) => setOpponentTeamId(e.target.value || null)}
          className="flex-1 bg-surface-raised text-text-primary font-body text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent border border-surface-raised"
        >
          <option value="">— Select opponent —</option>
          {opponents.map((t) => (
            <option key={t.id} value={t.id}>
              {t.playerName}
            </option>
          ))}
        </select>
      </div>

      {oppTeam && (
        <>
          <MatchupHero
            myTeam={myTeam}
            oppTeam={oppTeam}
            excludedMyIds={excludedMyIds}
            excludedOppIds={excludedOppIds}
            onToggleMyExclusion={toggleMyExclusion}
            onToggleOppExclusion={toggleOppExclusion}
          />

          <DefensiveTypeChart
            myTeam={activeMyPokemon}
            oppTeam={activeOppPokemon}
            myTeamName={myTeam.playerName}
            oppTeamName={oppTeam.playerName}
            gen={league.generation}
          />

          <CoveragePlanner
            oppTeam={activeOppPokemon}
            gen={league.generation}
            coverageTypes={coverageTypes}
            onToggleCoverageType={toggleCoverageType}
          />

          <SpeedTierTool
            myTeam={activeMyPokemon}
            oppTeam={activeOppPokemon}
            myTeamName={myTeam.playerName}
            oppTeamName={oppTeam.playerName}
          />

          <MoveCategoryPanel
            myCategories={myCategories}
            oppCategories={oppCategories}
            myTeamName={myTeam.playerName}
            oppTeamName={oppTeam.playerName}
            loading={movesLoading}
          />

        </>
      )}
    </div>
  );
}
