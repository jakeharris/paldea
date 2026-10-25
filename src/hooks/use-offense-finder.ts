import { useState, useEffect, useMemo } from "react";
import type { DraftPokemon } from "@/services/types";
import {
  findOffensiveLoadouts,
  type OffenseFinderOptions,
  type OffenseFinderResult,
} from "@/services/offense-finder";
import { fetchStandardSet } from "@/services/smogon";

/** Runs the Offense Finder search; cancel-safe and re-runs when inputs change */
export function useOffenseFinder(
  myTeam: DraftPokemon[],
  oppTeam: DraftPokemon[],
  gen: number,
  options: OffenseFinderOptions,
) {
  const [result, setResult] = useState<OffenseFinderResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"sets" | "calcs">("sets");
  const [error, setError] = useState<string | null>(null);

  const myKey = useMemo(() => myTeam.map((p) => `${p.name}${p.isTeraCaptain ? "*" : ""}`).join(","), [myTeam]);
  const oppKey = useMemo(() => oppTeam.map((p) => p.name).join(","), [oppTeam]);
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
      Promise.all(oppTeam.map((p) => fetchStandardSet(p.name, gen)))
        .then((sets) => {
          if (cancelled) return null;
          setPhase("calcs");
          return findOffensiveLoadouts(myTeam, oppTeam, gen, options, {
            isCancelled: () => cancelled,
            onProgress: (p) => { if (!cancelled) setProgress(p); },
          }, sets);
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
