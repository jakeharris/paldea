import { useRef, useState, forwardRef, useImperativeHandle } from "react";
import { usePokemonSearch } from "@/hooks/use-pokemon-search";
import { getSpecies, getDexSpecies, toDraftPokemon, getIconUrl, getSpriteUrl } from "@/services/pokemon-data";
import type { DraftPokemon } from "@/services/types";
import { TypeBadge } from "@/services/type-utils";

interface PokemonSearchProps {
  gen?: number;
  onSelect: (pokemon: DraftPokemon) => void;
  disabled?: boolean;
}

export interface PokemonSearchHandle {
  focus: () => void;
}

export const PokemonSearch = forwardRef<PokemonSearchHandle, PokemonSearchProps>(
  function PokemonSearch({ gen = 9, onSelect, disabled }, ref) {
    const inputRef = useRef<HTMLInputElement>(null);
    const { query, results, search, clear } = usePokemonSearch(gen);
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const [isOpen, setIsOpen] = useState(false);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
    }));

    function handleSelect(name: string) {
      const species = getSpecies(name, gen) ?? getDexSpecies(name);
      if (species) {
        onSelect(toDraftPokemon(species));
      }
      clear();
      setIsOpen(false);
      setHighlightIndex(-1);
    }

    function handleKeyDown(e: React.KeyboardEvent) {
      if (!isOpen || results.length === 0) return;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightIndex((i) => Math.min(i + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (highlightIndex >= 0 && results[highlightIndex]) {
            handleSelect(results[highlightIndex].name);
          }
          break;
        case "Escape":
          clear();
          setIsOpen(false);
          setHighlightIndex(-1);
          inputRef.current?.blur();
          break;
      }
    }

    return (
      <div className="relative z-20">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            search(e.target.value);
            setIsOpen(true);
            setHighlightIndex(0);
          }}
          onFocus={() => query && setIsOpen(true)}
          onBlur={() => {
            // Delay to allow click on dropdown
            setTimeout(() => setIsOpen(false), 150);
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Search Pokemon..."
          className="w-full glass rounded-pill px-5 py-3 font-body text-sm
                     text-text-primary placeholder:text-text-muted
                     focus:outline-none focus:ring-2 focus:ring-accent/40
                     disabled:opacity-50"
        />
        {isOpen && results.length > 0 && (
          <ul className="absolute z-50 mt-2 w-full rounded-card py-2 max-h-80 overflow-y-auto
                        bg-[#1a0030]/95 backdrop-blur-xl border border-white/10">
            {results.map((entry, i) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(entry.name)}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm
                    transition-colors ${
                      i === highlightIndex
                        ? "bg-surface-raised text-text-primary"
                        : "text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                    }`}
                >
                  <img
                    src={getIconUrl(entry.name)}
                    alt=""
                    className="w-8 h-8 object-contain"
                    loading="lazy"
                    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getSpriteUrl(entry.name); }}
                  />
                  <span className="font-body font-medium">{entry.name}</span>
                  <span className="ml-auto flex gap-1">
                    {entry.types.map((t) => (
                      <TypeBadge key={t} type={t} />
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  },
);

