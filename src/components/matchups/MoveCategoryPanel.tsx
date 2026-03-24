import { useState } from "react";
import type { AllMoveCategoryResults, MoveCategoryResult } from "@/services/matchup-calc";

interface MoveCategoryPanelProps {
  myCategories: AllMoveCategoryResults | null;
  oppCategories: AllMoveCategoryResults | null;
  myTeamName: string;
  oppTeamName: string;
  loading: boolean;
}

interface CategoryDef {
  key: keyof AllMoveCategoryResults;
  label: string;
}

const CATEGORIES: CategoryDef[] = [
  { key: "priority", label: "Priority" },
  { key: "pivot", label: "Pivots" },
  { key: "setup", label: "Setup" },
  { key: "hazardSet", label: "Hazards" },
  { key: "hazardClear", label: "Hazard Removal" },
  { key: "healing", label: "Healing" },
  { key: "status", label: "Status" },
  { key: "support", label: "Terrain, Weather & Screens" },
];

function CategorySection({
  label,
  entries,
}: {
  label: string;
  entries: MoveCategoryResult[];
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border-b border-surface-raised/50 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-surface-raised/30 transition-colors"
      >
        <span className="font-mono text-xs font-semibold text-text-secondary">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-text-muted bg-surface-raised px-1.5 py-0.5 rounded-pill">
            {entries.length}
          </span>
          <span className="text-text-muted text-xs">{open ? "▲" : "▼"}</span>
        </div>
      </button>
      {open && (
        <div className="px-3 pb-2">
          {entries.length === 0 ? (
            <p className="font-mono text-[10px] text-text-muted py-1">None</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {entries.map((entry) => (
                <div key={entry.pokemonName} className="flex flex-wrap items-start gap-1.5">
                  <div className="flex items-center gap-1 shrink-0">
                    <img
                      src={entry.pokemonIcon}
                      alt={entry.pokemonName}
                      className="w-4 h-4 [image-rendering:pixelated]"
                    />
                    <span className="font-mono text-[10px] text-text-secondary">{entry.pokemonName}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {entry.moves.map((move) => (
                      <span
                        key={move}
                        className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-surface-raised text-text-muted"
                      >
                        {move}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TeamColumn({
  teamName,
  categories,
  loading,
}: {
  teamName: string;
  categories: AllMoveCategoryResults | null;
  loading: boolean;
}) {
  return (
    <div className="flex-1 min-w-0 border border-surface-raised rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-surface-raised/30 border-b border-surface-raised">
        <p className="font-display text-sm font-semibold text-text-primary truncate">{teamName}</p>
      </div>
      {loading && !categories ? (
        <div className="p-3 flex flex-col gap-2">
          {CATEGORIES.map((c) => (
            <div key={c.key} className="animate-pulse">
              <div className="h-3 bg-surface-raised rounded w-24 mb-1" />
              <div className="h-2 bg-surface-raised/50 rounded w-full" />
            </div>
          ))}
        </div>
      ) : categories ? (
        <div>
          {CATEGORIES.map((c) => (
            <CategorySection
              key={c.key}
              label={c.label}
              entries={categories[c.key] ?? []}
            />
          ))}
        </div>
      ) : (
        <p className="font-body text-text-muted text-xs p-3">No data available.</p>
      )}
    </div>
  );
}

export function MoveCategoryPanel({
  myCategories,
  oppCategories,
  myTeamName,
  oppTeamName,
  loading,
}: MoveCategoryPanelProps) {
  return (
    <div className="glass rounded-card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-raised">
        <h3 className="font-display text-base font-semibold text-text-primary">
          Move Categories
        </h3>
        <p className="font-mono text-xs text-text-muted mt-0.5">
          Move pool analysis for both teams
        </p>
      </div>
      <div className="p-4 flex gap-4 flex-wrap">
        <TeamColumn
          teamName={myTeamName}
          categories={myCategories}
          loading={loading}
        />
        <TeamColumn
          teamName={oppTeamName}
          categories={oppCategories}
          loading={loading}
        />
      </div>
    </div>
  );
}
