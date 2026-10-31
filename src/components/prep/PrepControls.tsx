import type { ReactNode } from "react";
import type { DraftPokemon } from "@/services/types";
import type { StatSpread } from "@/services/damage";
import { iconFallback } from "@/services/pokemon-data";

/** Shared controls for the Prep Wizard tools */

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`text-[11px] font-body px-2.5 py-1 rounded-pill transition-colors ${
            value === o.value
              ? "bg-accent/20 text-accent"
              : "text-text-muted hover:text-text-secondary hover:bg-surface-raised"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Control({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-body text-[10px] uppercase tracking-widest text-text-muted">{label}</span>
      {children}
    </div>
  );
}

export function MonIcon({ mon, className = "w-6 h-6" }: { mon: DraftPokemon; className?: string }) {
  return (
    <img
      src={mon.icon}
      alt=""
      className={`${className} [image-rendering:pixelated] shrink-0`}
      onError={iconFallback(mon.name)}
    />
  );
}

export const STAT_LABELS = { hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" } as const;

export function spreadText(evs: StatSpread): string {
  return (Object.keys(STAT_LABELS) as (keyof typeof STAT_LABELS)[])
    .filter((k) => evs[k] > 0)
    .map((k) => `${evs[k]} ${STAT_LABELS[k]}`)
    .join(" / ");
}

export const selectClass =
  "bg-surface-raised text-text-primary font-body text-xs rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent border border-surface-raised";
