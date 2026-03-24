import { useState, useEffect } from "react";
import { fetchDraftAnalysis, getSmogonUrl, type DraftAnalysis } from "@/services/smogon";

interface SidePanelSmogonProps {
  pokemonName: string;
  gen?: number;
}

export function SidePanelSmogon({ pokemonName, gen = 9 }: SidePanelSmogonProps) {
  const [analysis, setAnalysis] = useState<DraftAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setAnalysis(null);

    async function load() {
      const result = await fetchDraftAnalysis(pokemonName, gen);
      if (!cancelled) {
        setAnalysis(result);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [pokemonName, gen]);

  if (loading) {
    return (
      <div className="py-4 px-1">
        <div className="h-3 w-24 bg-surface-raised rounded animate-pulse mb-3" />
        <div className="h-3 w-full bg-surface-raised rounded animate-pulse mb-2" />
        <div className="h-3 w-3/4 bg-surface-raised rounded animate-pulse mb-2" />
        <div className="h-3 w-5/6 bg-surface-raised rounded animate-pulse" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="py-4 px-1">
        <p className="text-text-muted text-xs font-mono">
          No draft analysis available for {pokemonName}.
        </p>
        <a
          href={getSmogonUrl(pokemonName, gen)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent text-xs font-mono hover:underline mt-1 inline-block"
        >
          View on Smogon →
        </a>
      </div>
    );
  }

  return (
    <div className="py-4 px-1">
      <h4 className="font-body font-semibold text-sm text-text-primary mb-2">
        Draft Analysis
      </h4>

      <p className="text-xs text-text-secondary leading-relaxed">
        {analysis.overview}
      </p>

      <a
        href={analysis.smogonUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent text-xs font-mono hover:underline mt-3 inline-block"
      >
        Read more on Smogon →
      </a>
    </div>
  );
}
