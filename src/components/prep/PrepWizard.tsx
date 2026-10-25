import { useState } from "react";
import type { DraftPokemon } from "@/services/types";
import { OffenseFinder } from "./OffenseFinder";

type PrepTool = "offense" | "defense" | "lines";

const TOOLS: { id: PrepTool; label: string; ready: boolean }[] = [
  { id: "offense", label: "Offense Finder", ready: true },
  { id: "defense", label: "Defense Finder", ready: false },
  { id: "lines", label: "Line Finder", ready: false },
];

interface PrepWizardProps {
  myTeam: DraftPokemon[];
  oppTeam: DraftPokemon[];
  gen: number;
}

export function PrepWizard({ myTeam, oppTeam, gen }: PrepWizardProps) {
  const [tool, setTool] = useState<PrepTool>("offense");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            disabled={!t.ready}
            onClick={() => setTool(t.id)}
            className={`text-xs font-body px-3 py-1.5 rounded-pill transition-colors ${
              tool === t.id
                ? "bg-accent/20 text-accent font-semibold"
                : t.ready
                  ? "text-text-secondary hover:text-text-primary hover:bg-surface-raised"
                  : "text-text-muted cursor-not-allowed"
            }`}
          >
            {t.label}
            {!t.ready && <span className="ml-1.5 text-[10px] uppercase tracking-wider">Soon</span>}
          </button>
        ))}
      </div>

      {tool === "offense" && <OffenseFinder myTeam={myTeam} oppTeam={oppTeam} gen={gen} />}
    </div>
  );
}
