import { useState } from "react";
import type { DraftPokemon } from "@/services/types";
import type { AttackerSet, KoHit, Loadout, OffenseFinderResult } from "@/services/offense-finder";
import type { DefenderMode } from "@/services/damage";
import { ATTACK_NATURES } from "@/services/damage";
import { TYPE_COLORS, TypeBadge } from "@/services/type-utils";
import { iconFallback } from "@/services/pokemon-data";
import { loadoutPaste, showdownCalcUrl } from "@/services/showdown-export";
import { Tooltip } from "@/components/ui/Tooltip";

interface LoadoutCardProps {
  loadout: Loadout;
  index: number;
  result: OffenseFinderResult;
  mode: DefenderMode;
  gen: number;
  level: number;
}

function Icon({ mon, className = "w-8 h-8" }: { mon: DraftPokemon; className?: string }) {
  return (
    <img
      src={mon.icon}
      alt={mon.name}
      className={`${className} [image-rendering:pixelated] shrink-0`}
      onError={iconFallback(mon.name)}
    />
  );
}

/** Always phrased from your side so it's clear who moves first */
const SPEED_LABEL: Record<KoHit["speed"], { text: string; title: string; className: string }> = {
  priority: { text: "You move first (priority)", title: "Priority move", className: "text-accent" },
  faster: { text: "You move first", title: "You outspeed even their max Speed, +Spe nature", className: "text-accent" },
  "faster-neutral": {
    text: "You move first unless +Spe", title: "You outspeed their max Speed with a neutral nature, but not +Spe", className: "text-amber-300",
  },
  "faster-standard": {
    text: "You outspeed their Smogon set", title: "Faster than their standard set, but not a max-Speed build", className: "text-amber-300",
  },
  slower: { text: "They move first", title: "They outspeed you — you need to survive a hit or switch in", className: "text-orange-400" },
};

function MoveChip({ name, type }: { name: string; type: string }) {
  return (
    <span
      className="px-2 py-0.5 rounded text-[11px] font-body font-semibold leading-tight"
      style={{ backgroundColor: `${TYPE_COLORS[type] ?? "#888"}33`, color: "var(--color-text-primary)", boxShadow: `inset 0 0 0 1px ${TYPE_COLORS[type] ?? "#888"}88` }}
    >
      {name}
    </span>
  );
}

function SetRow({ set, targets }: { set: AttackerSet; targets: OffenseFinderResult["targets"] }) {
  const focus = ATTACK_NATURES[set.nature].focus === "atk" ? "Atk" : "SpA";
  const moveTypes = new Map(set.kos.map((h) => [h.move, h.moveType]));
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon mon={set.pokemon} className="w-10 h-10" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-display text-sm font-semibold text-text-primary">{set.pokemon.name}</span>
          <span className="font-body text-xs text-text-secondary">
            {set.nature} · {set.item || "No boosting item needed"} · {set.ability}
          </span>
          {set.teraType && (
            <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-accent">
              TERA <TypeBadge type={set.teraType} />
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {set.moves.map((m) => <MoveChip key={m} name={m} type={moveTypes.get(m) ?? "Normal"} />)}
          {set.moves.length < 4 && (
            <span className="px-2 py-0.5 text-[11px] font-body text-text-muted">
              +{4 - set.moves.length} free slot{4 - set.moves.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <p className="font-body text-[11px] text-text-muted mt-1.5">
          252 {focus} / 252 Spe ({set.speedStat} Spe)
          {set.minFocusEvs !== undefined && set.minFocusEvs < 252 && (
            <> · KOs hold down to <span className="text-text-secondary">{set.minFocusEvs} {focus} EVs</span></>
          )}
          {" · "}OHKOs {set.kos.map((h) => targets[h.targetIndex].pokemon.name).join(", ")}
        </p>
      </div>
    </div>
  );
}

function CoverageCell({
  target,
  hits,
  bestEffort,
  setsById,
}: {
  target: OffenseFinderResult["targets"][number];
  hits: Loadout["coverage"][number]["hits"];
  bestEffort?: Loadout["coverage"][number]["bestEffort"];
  setsById: Map<string, AttackerSet>;
}) {
  const best = hits[0];
  if (!best) {
    const by = bestEffort ? setsById.get(bestEffort.setId) : undefined;
    return (
      <div className="glass rounded-lg p-2.5 flex flex-col items-center gap-1 border border-dashed border-surface-raised">
        <Icon mon={target.pokemon} className="w-8 h-8 opacity-60" />
        <span className="font-body text-[10px] text-text-secondary text-center leading-tight">{target.pokemon.name}</span>
        <span className="font-body text-[10px] text-orange-400">No OHKO</span>
        {bestEffort && by ? (
          <>
            <div className="flex items-center gap-1">
              <Icon mon={by.pokemon} className="w-5 h-5" />
              <span className="font-body text-[11px] text-text-secondary text-center leading-tight">{bestEffort.move}</span>
            </div>
            <span className="font-mono text-[10px] text-text-primary whitespace-nowrap">
              {bestEffort.minPercent.toFixed(0)}–{bestEffort.maxPercent.toFixed(0)}%
            </span>
            {bestEffort.addsMove && (
              <span className="font-body text-[10px] text-text-muted text-center leading-tight">uses a free slot</span>
            )}
          </>
        ) : (
          <span className="font-body text-[10px] text-text-muted">No damage</span>
        )}
      </div>
    );
  }
  const attacker = setsById.get(best.setId)!;
  const speed = SPEED_LABEL[best.hit.speed];
  const backups = hits.slice(1).filter((h) => h.setId !== best.setId);
  return (
    <Tooltip
      content={
        <div className="flex flex-col gap-1 max-w-xs whitespace-normal">
          {hits.flatMap((h, i) =>
            Object.values(h.hit.vs).map((out, j) => (
              <span key={`${i}-${j}`} className={i === 0 ? "text-text-primary" : "text-text-muted"}>{out!.desc}</span>
            )),
          )}
        </div>
      }
    >
      <div className="glass rounded-lg p-2.5 flex flex-col items-center gap-1 h-full">
        <Icon mon={target.pokemon} />
        <span className="font-body text-[10px] text-text-secondary text-center leading-tight">{target.pokemon.name}</span>
        <div className="flex items-center gap-1">
          <Icon mon={attacker.pokemon} className="w-5 h-5" />
          <span className="font-body text-[11px] font-semibold text-text-primary text-center leading-tight">{best.hit.move}</span>
        </div>
        {(["standard", "counter"] as const).map((build) => {
          const out = best.hit.vs[build];
          if (!out) return null;
          const limiting = best.hit.limitingBuild === build;
          return (
            <span
              key={build}
              className={`flex flex-col items-center leading-tight ${limiting ? "text-text-primary" : "text-text-muted"}`}
              title={limiting ? "The build that limits this KO" : undefined}
            >
              <span className="font-body text-[9px] uppercase tracking-wider">
                {build === "standard" ? (target.smogonSet ? "Smogon" : "Standard") : "Counter"}
              </span>
              <span className="font-mono text-[10px] whitespace-nowrap">
                {out.minPercent.toFixed(0)}–{out.maxPercent.toFixed(0)}%
                {out.ohkoChance < 0.999 && ` · ${(out.ohkoChance * 100).toFixed(0)}%`}
              </span>
            </span>
          );
        })}
        <span className={`font-body text-[10px] text-center leading-tight ${speed.className}`} title={speed.title}>
          {speed.text}
        </span>
        {best.hit.accuracy < 100 && (
          <span className="font-body text-[10px] text-amber-300">{best.hit.accuracy}% acc</span>
        )}
        {best.hit.usesTera && <span className="font-body text-[10px] text-accent">Needs Tera</span>}
        {best.hit.tags.map((t) => (
          <span key={t} className="font-body text-[10px] text-orange-400 text-center">{t}</span>
        ))}
        {backups.length > 0 && (
          <span className="font-body text-[10px] text-text-muted">+{backups.length} backup</span>
        )}
      </div>
    </Tooltip>
  );
}

export function LoadoutCard({ loadout, index, result, mode, gen, level }: LoadoutCardProps) {
  const [copied, setCopied] = useState(false);
  const paste = loadoutPaste(loadout, index + 1, result, mode, level);
  const setsById = new Map(loadout.sets.map((s) => [s.id, s]));
  const total = result.targets.length;

  async function copy() {
    try {
      await navigator.clipboard.writeText(paste);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the textarea below is still selectable */
    }
  }

  return (
    <div className="glass rounded-card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-raised flex flex-wrap items-center gap-x-3 gap-y-2">
        <h4 className="font-display text-base font-semibold text-text-primary">
          Loadout {index + 1}
        </h4>
        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-pill bg-accent/20 text-accent">
          OHKOs {loadout.covered}/{total}
        </span>
        <span className="font-body text-xs text-text-muted">
          {loadout.reliable} clean · you move first on {loadout.firstStrike} · {loadout.redundant} with backup
        </span>
        {loadout.usesTera && (
          <span className="font-body text-[11px] px-2 py-0.5 rounded-pill bg-surface-raised text-text-secondary">Uses Tera</span>
        )}
        {loadout.extraMon && (
          <span className="font-body text-[11px] px-2 py-0.5 rounded-pill bg-surface-raised text-text-secondary">+1 attacker</span>
        )}
        <span
          className={`font-body text-[11px] px-2 py-0.5 rounded-pill ${
            loadout.pointsOfFailure.length === 0 ? "bg-accent/20 text-accent" : "bg-surface-raised text-text-secondary"
          }`}
          title="Fewest OHKOs left after losing any one member"
        >
          Lose one → {loadout.resilience}/{total}
        </span>
        <div className="flex gap-2 ml-auto">
          <button
            onClick={copy}
            className="text-[11px] font-body px-3 py-1 rounded-pill text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors"
          >
            {copied ? "Copied!" : "Copy import"}
          </button>
          <a
            href={showdownCalcUrl(paste, gen)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-body font-semibold px-3 py-1 rounded-pill bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
            title="Opens the Showdown calc with these sets in its Import box — click Import there"
          >
            Open in Showdown calc ↗
          </a>
        </div>
      </div>

      {loadout.pointsOfFailure.length > 0 && (
        <p className="px-4 pt-2 font-body text-[11px] text-orange-400">
          Drops below {result.goalReached ? result.goal : result.bestCoverage} OHKOs without{" "}
          {loadout.pointsOfFailure.join(" or ")}
        </p>
      )}

      <div className="px-4 divide-y divide-surface-raised">
        {loadout.sets.map((s) => <SetRow key={s.id} set={s} targets={result.targets} />)}
      </div>

      <div className="px-4 pb-4 pt-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {loadout.coverage.map((c) => (
            <CoverageCell
              key={c.targetIndex}
              target={result.targets[c.targetIndex]}
              hits={c.hits}
              bestEffort={c.bestEffort}
              setsById={setsById}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
