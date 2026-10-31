import { useState, useEffect, useMemo } from "react";
import type { DraftPokemon } from "@/services/types";
import {
  findDefensiveMatchups,
  type DefenseFinderOptions,
  type DefenseFinderResult,
} from "@/services/defense-finder";
import { fetchStandardSet } from "@/services/smogon";

/** Runs the Defense Finder calcs; cancel-safe and re-runs when inputs change */
export function useDefenseFinder(
  myTeam: DraftPokemon[],
  oppTeam: DraftPokemon[],
  gen: number,
  options: DefenseFinderOptions,
) {
  const [result, setResult] = useState<DefenseFinderResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"sets" | "calcs">("sets");
  const [error, setError] = useState<string | null>(null);

  const myKey = useMemo(() => myTeam.map((p) => `${p.name}${p.isTeraCaptain ? "*" : ""}`).join(","), [myTeam]);
  const oppKey = useMemo(() => oppTeam.map((p) => `${p.name}${p.isTeraCaptain ? "*" : ""}`).join(","), [oppTeam]);
  const optionsKey = JSON.stringify(options);

  useEffect(() => {
    if (myTeam.length === 0 || oppTeam.length === 0) {
      setResult(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setProgress(0);
    setError(null);

    setPhase("sets");

    // Let the spinner paint before the first batch of calcs
    const timer = setTimeout(() => {
      // Smogon sets are cached (memory + Cache API), so option changes don't refetch
      Promise.all([
        Promise.all(oppTeam.map((p) => fetchStandardSet(p.name, gen))),
        Promise.all(myTeam.map((p) => fetchStandardSet(p.name, gen))),
      ])
        .then(([oppSets, mySets]) => {
          if (cancelled) return null;
          setPhase("calcs");
          return findDefensiveMatchups(myTeam, oppTeam, gen, options, {
            isCancelled: () => cancelled,
            onProgress: (p) => { if (!cancelled) setProgress(p); },
          }, oppSets, mySets);
        })
        .then((r) => {
          if (cancelled || !r) return;
          setResult(r);
          setLoading(false);
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        });
    }, 50);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myKey, oppKey, gen, optionsKey]);

  return { result, loading, progress, phase, error };
}
