import { useState, useEffect, useMemo } from "react";
import type { DraftPokemon, ChecklistItem } from "@/services/types";
import { runSyncChecks, runAsyncChecks } from "@/services/checklist";

export function useTeamChecklist(team: DraftPokemon[], gen: number = 9) {
  const syncItems = useMemo(() => runSyncChecks(team), [team]);
  const [asyncItems, setAsyncItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Compute a stable key from team composition
  const teamKey = useMemo(
    () => team.map((p) => p.id).join(","),
    [team],
  );

  useEffect(() => {
    if (team.length === 0) {
      setAsyncItems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    runAsyncChecks(team, gen).then((items) => {
      if (!cancelled) {
        setAsyncItems(items);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [teamKey, gen]);

  return { items: [...syncItems, ...asyncItems], loading };
}
