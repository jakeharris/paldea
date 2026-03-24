import { useState, useEffect, useMemo } from "react";
import type { DraftPokemon } from "@/services/types";
import { categorizeTeamMoves, type AllMoveCategoryResults } from "@/services/matchup-calc";

export function useMatchupMoves(
  myTeam: DraftPokemon[],
  oppTeam: DraftPokemon[],
  gen: number,
) {
  const [myCategories, setMyCategories] = useState<AllMoveCategoryResults | null>(null);
  const [oppCategories, setOppCategories] = useState<AllMoveCategoryResults | null>(null);
  const [loading, setLoading] = useState(false);

  const myKey = useMemo(() => myTeam.map((p) => p.name).join(","), [myTeam]);
  const oppKey = useMemo(() => oppTeam.map((p) => p.name).join(","), [oppTeam]);

  useEffect(() => {
    if (myTeam.length === 0 && oppTeam.length === 0) {
      setMyCategories(null);
      setOppCategories(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([
      myTeam.length > 0 ? categorizeTeamMoves(myTeam, gen) : Promise.resolve(null),
      oppTeam.length > 0 ? categorizeTeamMoves(oppTeam, gen) : Promise.resolve(null),
    ]).then(([myResult, oppResult]) => {
      if (!cancelled) {
        setMyCategories(myResult);
        setOppCategories(oppResult);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [myKey, oppKey, gen]);

  return { myCategories, oppCategories, loading };
}
