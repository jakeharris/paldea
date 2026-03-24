import { useState } from "react";
import type { DraftPokemon } from "@/services/types";
import { getAnimatedSpriteUrl, getSpriteUrl } from "@/services/pokemon-data";
import { TYPE_COLORS } from "@/services/type-utils";

export function SidePanelSprite({ pokemon }: { pokemon: DraftPokemon }) {
  const animatedUrl = getAnimatedSpriteUrl(pokemon.name);
  const fallbackUrl = getSpriteUrl(pokemon.name);
  const [useAnimated, setUseAnimated] = useState(true);

  // Reset to try animated whenever the pokemon changes
  const [prevName, setPrevName] = useState(pokemon.name);
  if (pokemon.name !== prevName) {
    setPrevName(pokemon.name);
    setUseAnimated(true);
  }

  return (
    <div className="flex flex-col items-center py-4">
      <div className="w-40 h-40 flex items-center justify-center">
        <img
          src={useAnimated ? animatedUrl : fallbackUrl}
          alt={pokemon.name}
          className="max-w-full max-h-full object-contain [image-rendering:pixelated]"
          onError={() => {
            if (useAnimated) setUseAnimated(false);
          }}
        />
      </div>
      <h3 className="font-display text-lg font-semibold text-text-primary mt-2">
        {pokemon.name}
      </h3>
      <div className="flex gap-1.5 mt-1">
        {pokemon.types.map((t) => (
          <span
            key={t}
            className="px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase"
            style={{ backgroundColor: TYPE_COLORS[t] ?? "#888", color: "#fff" }}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
