import { useTeamChecklist } from "@/hooks/use-team-checklist";
import { Tooltip } from "@/components/ui/Tooltip";
import type { DraftPokemon } from "@/services/types";

interface SidePanelChecklistProps {
  team: DraftPokemon[];
  gen?: number;
}

export function SidePanelChecklist({ team, gen = 9 }: SidePanelChecklistProps) {
  const { items, loading } = useTeamChecklist(team, gen);

  return (
    <div className="py-4 px-1">
      <h4 className="font-body font-semibold text-sm text-text-primary mb-3">
        Team Checklist
      </h4>
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <Tooltip
            key={item.id}
            content={
              item.contributors.length > 0 ? (
                <div className="flex flex-col gap-0.5">
                  {item.contributors.map((name) => (
                    <span key={name} className="text-text-primary">{name}</span>
                  ))}
                </div>
              ) : (
                <span className="text-text-muted">No Pokemon yet</span>
              )
            }
          >
            <div className="flex items-center gap-2 py-1 px-2 rounded
                           hover:bg-surface-raised transition-colors cursor-default">
              <span className={`text-sm ${item.met ? "text-teal-400" : "text-red-400"}`}>
                {item.met ? "✓" : "✗"}
              </span>
              <span
                className={`text-xs font-mono ${
                  item.met ? "text-text-secondary" : "text-text-muted"
                }`}
              >
                {item.label}
              </span>
            </div>
          </Tooltip>
        ))}
        {loading && (
          <div className="flex items-center gap-2 py-1 px-2">
            <span className="text-xs font-mono text-text-muted animate-pulse">
              Checking move pools...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
