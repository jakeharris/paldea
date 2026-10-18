import { useEffect } from "react";
import { SidePanelSprite } from "./SidePanelSprite";
import { SidePanelSmogon } from "./SidePanelSmogon";
import { SidePanelChecklist } from "./SidePanelChecklist";
import type { DraftPokemon, DraftTeam, League } from "@/services/types";

interface SidePanelProps {
  pokemon: DraftPokemon;
  team: DraftTeam;
  league: League;
  onClose: () => void;
}

export function SidePanel({ pokemon, team, league, onClose }: SidePanelProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Below lg there's no room beside the rosters, so the panel becomes a
  // full-width, opaque bottom sheet over a scrim. At lg+ it's a sticky sidebar.
  return (
    <>
      <div
        className="fixed inset-0 z-[55] bg-black/60 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label={`${pokemon.name} analysis`}
        className="fixed inset-x-0 bottom-0 z-[60] max-h-[85dvh] overflow-y-auto overscroll-contain
                   bg-surface border-t border-surface-raised rounded-t-card shadow-2xl
                   lg:sticky lg:top-24 lg:z-auto lg:w-[400px] lg:shrink-0
                   lg:max-h-[calc(100dvh-120px)] lg:rounded-card lg:shadow-none lg:glass-heavy"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-pill bg-surface-raised lg:hidden" />
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-text-muted uppercase">
              {team.playerName}
            </span>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-text-muted hover:text-text-primary transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>

          <SidePanelSprite pokemon={pokemon} />

          <div className="border-t border-surface-raised my-2" />

          <SidePanelSmogon pokemonName={pokemon.name} gen={league.generation} />

          <div className="border-t border-surface-raised my-2" />

          <SidePanelChecklist team={team.pokemon} gen={league.generation} />
        </div>
      </div>
    </>
  );
}
