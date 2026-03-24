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
  return (
    <div className="w-[400px] shrink-0 glass-heavy rounded-card overflow-y-auto max-h-[calc(100dvh-120px)] sticky top-24">
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono text-text-muted uppercase">
            {team.playerName}
          </span>
          <button
            onClick={onClose}
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
  );
}
