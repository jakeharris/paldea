import { useMemo } from "react";
import type { DraftPokemon } from "@/services/types";
import { computeCoverage, ALL_TYPES } from "@/services/matchup-calc";
import { TypeBadge, TYPE_COLORS } from "@/services/type-utils";
import { getSpriteUrl } from "@/services/pokemon-data";

interface CoveragePlannerProps {
  oppTeam: DraftPokemon[];
  gen: number;
  coverageTypes: Set<string>;
  onToggleCoverageType: (type: string) => void;
}

function MultiplierBadge({ multiplier }: { multiplier: number }) {
  if (multiplier === 0) {
    return (
      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
        Immune
      </span>
    );
  }
  if (multiplier === 0.25) {
    return (
      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-600/20 text-orange-500">
        ¼×
      </span>
    );
  }
  if (multiplier === 0.5) {
    return (
      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-400/20 text-orange-400">
        ½×
      </span>
    );
  }
  if (multiplier === 1) {
    return (
      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-raised text-text-muted">
        1×
      </span>
    );
  }
  if (multiplier === 2) {
    return (
      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
        2×
      </span>
    );
  }
  if (multiplier === 4) {
    return (
      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-400/30 text-green-300">
        4×
      </span>
    );
  }
  return (
    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-raised text-text-muted">
      {multiplier}×
    </span>
  );
}

export function CoveragePlanner({
  oppTeam,
  gen,
  coverageTypes,
  onToggleCoverageType,
}: CoveragePlannerProps) {
  const selectedTypesArray = useMemo(() => [...coverageTypes], [coverageTypes]);

  const results = useMemo(
    () =>
      coverageTypes.size > 0
        ? computeCoverage(selectedTypesArray, oppTeam, gen)
        : [],
    [selectedTypesArray, oppTeam, gen, coverageTypes.size],
  );

  return (
    <div className="glass rounded-card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-raised">
        <h3 className="font-display text-base font-semibold text-text-primary">
          Coverage Planner
        </h3>
        <p className="font-body text-xs text-text-muted mt-0.5">
          Select offensive types to see how they hit the opponent's team
        </p>
      </div>

      {/* Type selector */}
      <div className="px-4 py-3 border-b border-surface-raised">
        <div className="flex flex-wrap gap-1.5">
          {ALL_TYPES.map((type) => {
            const selected = coverageTypes.has(type);
            return (
              <button
                key={type}
                onClick={() => onToggleCoverageType(type)}
                className={`transition-all duration-150 rounded ${
                  selected ? "ring-2 ring-white scale-105" : "opacity-50 hover:opacity-75"
                }`}
              >
                <span
                  className="px-2 py-1 rounded text-[11px] font-mono font-bold uppercase leading-none block"
                  style={{ backgroundColor: TYPE_COLORS[type] ?? "#888", color: "#fff" }}
                >
                  {type}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      <div className="p-4">
        {oppTeam.length === 0 ? (
          <p className="font-body text-text-muted text-sm text-center py-6">
            No active opponent Pokémon to analyze.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {coverageTypes.size === 0
              ? oppTeam.map((mon) => (
                  <div
                    key={mon.id}
                    className="glass rounded-lg p-3 flex flex-col items-center gap-2 opacity-35"
                  >
                    <img
                      src={mon.icon}
                      alt={mon.name}
                      className="w-8 h-8 [image-rendering:pixelated]"
                      onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getSpriteUrl(mon.name); }}
                    />
                    <span className="font-body text-[10px] text-text-secondary text-center leading-tight">
                      {mon.name}
                    </span>
                    {/* Reserve space for multiplier badge + one type row so height doesn't jump */}
                    <span className="invisible font-mono text-[10px] font-bold px-1.5 py-0.5 rounded">—</span>
                    <div className="invisible flex flex-wrap gap-0.5 justify-center">
                      <TypeBadge type="Normal" />
                    </div>
                  </div>
                ))
              : results.map((result) => (
                  <div
                    key={result.pokemon.id}
                    className="glass rounded-lg p-3 flex flex-col items-center gap-2"
                  >
                    <img
                      src={result.pokemon.icon}
                      alt={result.pokemon.name}
                      className="w-8 h-8 [image-rendering:pixelated]"
                      onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getSpriteUrl(result.pokemon.name); }}
                    />
                    <span className="font-body text-[10px] text-text-secondary text-center leading-tight">
                      {result.pokemon.name}
                    </span>
                    <MultiplierBadge multiplier={result.bestMultiplier} />
                    {result.effectiveTypes.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 justify-center">
                        {result.effectiveTypes.map((t) => (
                          <TypeBadge key={t} type={t} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
          </div>
        )}
      </div>
    </div>
  );
}
