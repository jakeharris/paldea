import { useState } from "react";
import type { DraftTeam } from "@/services/types";
import { getAnimatedSpriteUrl, getSpriteUrl } from "@/services/pokemon-data";

interface MatchupHeroProps {
  myTeam: DraftTeam;
  oppTeam: DraftTeam;
  excludedMyIds: Set<number>;
  excludedOppIds: Set<number>;
  onToggleMyExclusion: (index: number) => void;
  onToggleOppExclusion: (index: number) => void;
}

function PokemonSprite({
  name,
  excluded,
  onToggle,
}: {
  name: string;
  excluded: boolean;
  onToggle: () => void;
}) {
  const [useAnimated, setUseAnimated] = useState(true);
  const animatedUrl = getAnimatedSpriteUrl(name);
  const fallbackUrl = getSpriteUrl(name);

  return (
    <div className="flex flex-col items-center gap-1 relative group/sprite">
      <div className={`relative transition-all duration-200 ${excluded ? "opacity-40 grayscale" : ""}`}>
        <img
          src={useAnimated ? animatedUrl : fallbackUrl}
          alt={name}
          className="w-16 h-16 object-contain [image-rendering:pixelated]"
          onError={() => { if (useAnimated) setUseAnimated(false); }}
        />
        {/* Checkbox overlay */}
        <button
          onClick={onToggle}
          className="absolute inset-0 flex items-end justify-end p-0.5 opacity-0 group-hover/sprite:opacity-100 transition-opacity"
          title={excluded ? "Include" : "Exclude"}
        >
          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center text-[9px] font-bold
            ${excluded
              ? "bg-surface-overlay border-text-muted text-text-muted"
              : "bg-accent/20 border-accent text-accent"
            }`}
          >
            {excluded ? "✕" : "✓"}
          </div>
        </button>
      </div>
      <span className={`font-body text-[10px] text-center max-w-[70px] leading-tight
        ${excluded ? "line-through text-text-muted" : "text-text-secondary"}`}
      >
        {name}
      </span>
    </div>
  );
}

export function MatchupHero({
  myTeam,
  oppTeam,
  excludedMyIds,
  excludedOppIds,
  onToggleMyExclusion,
  onToggleOppExclusion,
}: MatchupHeroProps) {
  return (
    <div className="glass-heavy rounded-card p-6 overflow-hidden relative">
      {/* Background gradient accents */}
      <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 via-transparent to-orange-500/5 pointer-events-none" />

      <div className="relative flex items-center gap-4">
        {/* My team */}
        <div className="flex-1 min-w-0">
          <p className="font-display text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">
            My Team
          </p>
          <h2 className="font-display text-lg font-bold text-gradient-accent mb-3">
            {myTeam.playerName}
          </h2>
          <div className="flex flex-wrap gap-3">
            {myTeam.pokemon.map((p, i) => (
              <PokemonSprite
                key={p.id}
                name={p.name}
                excluded={excludedMyIds.has(i)}
                onToggle={() => onToggleMyExclusion(i)}
              />
            ))}
          </div>
        </div>

        {/* VS divider */}
        <div className="flex flex-col items-center shrink-0">
          <span className="font-display text-4xl font-black text-text-muted/30 select-none">
            VS
          </span>
        </div>

        {/* Opponent team */}
        <div className="flex-1 min-w-0 text-right">
          <p className="font-display text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">
            Opponent
          </p>
          <h2 className="font-display text-lg font-bold text-text-primary mb-3">
            {oppTeam.playerName}
          </h2>
          <div className="flex flex-wrap gap-3 justify-end">
            {oppTeam.pokemon.map((p, i) => (
              <PokemonSprite
                key={p.id}
                name={p.name}
                excluded={excludedOppIds.has(i)}
                onToggle={() => onToggleOppExclusion(i)}
              />
            ))}
          </div>
        </div>
      </div>

      <p className="font-body text-[10px] text-text-muted mt-4">
        Hover a sprite and click the checkmark to exclude a Pokémon from analysis
      </p>
    </div>
  );
}
