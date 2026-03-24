import type { DraftPokemon } from "@/services/types";
import { getIconUrl } from "@/services/pokemon-data";

interface PokemonRowProps {
  pokemon: DraftPokemon;
  onClick: () => void;
  onToggleTera: () => void;
  onRemove: () => void;
}

export function PokemonRow({ pokemon, onClick, onToggleTera, onRemove }: PokemonRowProps) {
  const bst =
    pokemon.baseStats.hp +
    pokemon.baseStats.atk +
    pokemon.baseStats.def +
    pokemon.baseStats.spa +
    pokemon.baseStats.spd +
    pokemon.baseStats.spe;

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer
                 hover:bg-surface-raised transition-colors group"
      onClick={onClick}
    >
      <img
        src={getIconUrl(pokemon.name)}
        alt={pokemon.name}
        className="w-10 h-10 object-contain shrink-0"
        loading="lazy"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-body font-semibold text-sm text-text-primary truncate">
            {pokemon.name}
          </span>
          {pokemon.isTeraCaptain && (
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded
                           bg-accent/20 text-accent leading-none shrink-0">
              TERA
            </span>
          )}
        </div>
        <div className="flex gap-1 mt-0.5 flex-wrap">
          <AbilityTag label={pokemon.abilities.primary} />
          {pokemon.abilities.secondary && (
            <AbilityTag label={pokemon.abilities.secondary} />
          )}
          {pokemon.abilities.hidden && (
            <AbilityTag label={pokemon.abilities.hidden} isHidden />
          )}
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-1 shrink-0">
        <StatMini label="HP" value={pokemon.baseStats.hp} />
        <StatMini label="Atk" value={pokemon.baseStats.atk} />
        <StatMini label="Def" value={pokemon.baseStats.def} />
        <StatMini label="SpA" value={pokemon.baseStats.spa} />
        <StatMini label="SpD" value={pokemon.baseStats.spd} />
        <StatMini label="Spe" value={pokemon.baseStats.spe} />
        <span className="font-mono text-xs text-text-muted ml-1 w-8 text-right">
          {bst}
        </span>
      </div>

      <label
        className="shrink-0 flex items-center gap-1 text-[10px] font-mono text-text-muted"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={pokemon.isTeraCaptain}
          onChange={onToggleTera}
          className="accent-accent w-3.5 h-3.5"
        />
        Tera
      </label>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="shrink-0 opacity-0 group-hover:opacity-100 text-text-muted
                   hover:text-red-400 transition-all text-sm px-1"
        title="Remove"
      >
        ×
      </button>
    </div>
  );
}

function AbilityTag({ label, isHidden }: { label: string; isHidden?: boolean }) {
  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[10px] font-mono leading-none ${
        isHidden
          ? "bg-purple-500/20 text-purple-200"
          : "bg-surface-overlay text-text-secondary"
      }`}
    >
      {label}
      {isHidden && " (H)"}
    </span>
  );
}

function statColor(value: number): string {
  if (value >= 130) return "text-teal-400";
  if (value >= 100) return "text-teal-300";
  if (value >= 80) return "text-text-secondary";
  if (value >= 60) return "text-warm-400";
  return "text-red-400";
}

function StatMini({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center w-7">
      <span className="text-[8px] font-mono text-text-muted uppercase">{label}</span>
      <span className={`text-[11px] font-mono font-bold ${statColor(value)}`}>
        {value}
      </span>
    </div>
  );
}
