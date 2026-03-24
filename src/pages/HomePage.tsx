import { useState, useMemo } from "react";
import { Link } from "react-router";
import { useLeagueState } from "@/context/league-context";
import { MatchupHero } from "@/components/matchups/MatchupHero";

export function HomePage() {
  const state = useLeagueState();
  const [excludedMyIds, setExcludedMyIds] = useState<Set<number>>(new Set());
  const [excludedOppIds, setExcludedOppIds] = useState<Set<number>>(new Set());

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

  const opponents = useMemo(
    () => league?.teams.filter((t) => !t.isMyTeam) ?? [],
    [league],
  );

  const hasAnyTeams = (league?.teams.length ?? 0) > 0;
  const isFullySetUp = myTeam !== null && opponents.length > 0;

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

  if (isFullySetUp) {
    return (
      <div className="flex flex-col gap-4">
        <MatchupHero
          myTeam={myTeam!}
          oppTeam={opponents[0]}
          excludedMyIds={excludedMyIds}
          excludedOppIds={excludedOppIds}
          onToggleMyExclusion={toggleMyExclusion}
          onToggleOppExclusion={toggleOppExclusion}
        />
        <div>
          <Link
            to="/matchups"
            className="gradient-accent text-purple-950 font-body font-semibold
                       px-5 py-2.5 rounded-pill
                       hover:opacity-90 transition-opacity inline-block"
          >
            Go to Matchups
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-card p-8">
      <h2 className="font-display text-xl font-semibold mb-4 text-warm-100">
        Welcome to PALDEA
      </h2>
      <p className="text-text-secondary leading-relaxed max-w-prose">
        Your Pokemon draft league command center. Build rosters, analyze
        matchups, and impress your league.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          to="/teams"
          className="gradient-accent text-purple-950 font-body font-semibold
                     px-5 py-2.5 rounded-pill
                     hover:opacity-90 transition-opacity"
        >
          {hasAnyTeams ? "Continue Registration" : "Get Started"}
        </Link>
        <a
          href="https://github.com/jakeharris/paldea"
          target="_blank"
          rel="noreferrer"
          className="glass px-5 py-2.5 rounded-pill font-body
                     text-text-primary hover:bg-surface-overlay
                     transition-colors"
        >
          View Code
        </a>
      </div>
    </div>
  );
}
