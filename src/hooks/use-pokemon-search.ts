import { useState, useRef, useCallback } from "react";
import {
  getSpeciesList,
  type SpeciesEntry,
} from "@/services/pokemon-data";

export function usePokemonSearch(gen: number = 9) {
  const listRef = useRef<SpeciesEntry[] | null>(null);
  const [results, setResults] = useState<SpeciesEntry[]>([]);
  const [query, setQuery] = useState("");

  const ensureList = useCallback(() => {
    if (!listRef.current) {
      listRef.current = getSpeciesList(gen);
    }
    return listRef.current;
  }, [gen]);

  const search = useCallback(
    (q: string) => {
      setQuery(q);
      if (!q.trim()) {
        setResults([]);
        return;
      }
      const list = ensureList();
      const lower = q.toLowerCase();
      // Prioritize startsWith, then includes
      const starts: SpeciesEntry[] = [];
      const contains: SpeciesEntry[] = [];
      for (const entry of list) {
        const nameLower = entry.name.toLowerCase();
        if (nameLower.startsWith(lower)) {
          starts.push(entry);
        } else if (nameLower.includes(lower)) {
          contains.push(entry);
        }
        if (starts.length + contains.length >= 15) break;
      }
      setResults([...starts, ...contains].slice(0, 15));
    },
    [ensureList],
  );

  const clear = useCallback(() => {
    setQuery("");
    setResults([]);
  }, []);

  return { query, results, search, clear };
}
