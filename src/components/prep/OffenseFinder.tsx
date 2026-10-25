import { useState } from "react";
import type { DraftPokemon } from "@/services/types";
import {
  DEFAULT_OFFENSE_OPTIONS,
  type KoThreshold,
  type OffenseFinderOptions,
} from "@/services/offense-finder";
import {
  ATTACK_NATURES,
  DEFENDER_MODES,
  type DefenderMode,
  type TerrainOption,
  type WeatherOption,
} from "@/services/damage";
import type { AttackerSet, TargetInfo } from "@/services/offense-finder";
import { getSpriteUrl } from "@/services/pokemon-data";
import { useOffenseFinder } from "@/hooks/use-offense-finder";
import { LoadoutCard } from "./LoadoutCard";

interface OffenseFinderProps {
  myTeam: DraftPokemon[];
  oppTeam: DraftPokemon[];
  gen: number;
}

function Segmented<T extends string | number>({
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

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-body text-[10px] uppercase tracking-widest text-text-muted">{label}</span>
      {children}
    </div>
  );
}

function MonIcon({ mon, className = "w-6 h-6" }: { mon: DraftPokemon; className?: string }) {
  return (
    <img
      src={mon.icon}
      alt=""
      className={`${className} [image-rendering:pixelated] shrink-0`}
      onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getSpriteUrl(mon.name); }}
    />
  );
}

const STAT_LABELS = { hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" } as const;

function spreadText(evs: TargetInfo["standard"]["evs"]): string {
  return (Object.keys(STAT_LABELS) as (keyof typeof STAT_LABELS)[])
    .filter((k) => evs[k] > 0)
    .map((k) => `${evs[k]} ${STAT_LABELS[k]}`)
    .join(" / ");
}

/** The standard build each opponent was calced with */
function TheirBuilds({ targets }: { targets: TargetInfo[] }) {
  const missing = targets.filter((t) => !t.smogonSet).length;
  return (
    <details className="rounded-lg bg-surface-raised px-3 py-2 group/builds">
      <summary className="font-body text-xs text-text-secondary cursor-pointer select-none">
        Their standard builds
        {missing > 0 && <span className="text-amber-300"> · {missing} without a Smogon set</span>}
      </summary>
      <div className="flex flex-col gap-1.5 mt-2">
        {targets.map((t) => (
          <div key={t.pokemon.id} className="flex items-center gap-2 font-body text-[11px]">
            <MonIcon mon={t.pokemon} />
            <span className="text-text-primary w-24 shrink-0">{t.pokemon.name}</span>
            {t.smogonSet ? (
              <span className="text-text-secondary">
                {t.smogonSet.format} "{t.smogonSet.name}" · {t.standard.nature} {spreadText(t.standard.evs)}
                {t.standard.item && ` @ ${t.standard.item}`} · {t.standard.ability || "worst-case ability"}
              </span>
            ) : (
              <span className="text-amber-300">No Smogon set — assumed 252 HP, neutral, worst-case ability</span>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}

/** Sets that hit the goal alone — good to know, not a plan */
function SoloThreats({ sets, targets }: { sets: AttackerSet[]; targets: TargetInfo[] }) {
  return (
    <div className="rounded-lg border border-accent/30 px-3 py-2 flex flex-col gap-1.5">
      <p className="font-body text-xs text-text-secondary">
        <span className="font-semibold text-accent">Solo threats</span> — each OHKOs the goal by itself. Worth
        knowing, but don't build around one: the loadouts below keep coverage when someone goes down.
      </p>
      {sets.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 font-body text-[11px]">
          <MonIcon mon={s.pokemon} />
          <span className="text-text-primary font-semibold">{s.pokemon.name}</span>
          <span className="text-text-secondary">
            {s.nature} · {s.item || "no boosting item"} · {s.ability}
            {s.teraType && ` · Tera ${s.teraType}`} · {s.moves.join(" / ")}
          </span>
          <span className="text-text-muted">
            → {s.kos.map((h) => targets[h.targetIndex].pokemon.name).join(", ")}
            {s.minFocusEvs !== undefined && s.minFocusEvs < 252 &&
              ` (holds at ${s.minFocusEvs} ${ATTACK_NATURES[s.nature].focus === "atk" ? "Atk" : "SpA"} EVs)`}
          </span>
        </div>
      ))}
    </div>
  );
}

const selectClass =
  "bg-surface-raised text-text-primary font-body text-xs rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent border border-surface-raised";

export function OffenseFinder({ myTeam, oppTeam, gen }: OffenseFinderProps) {
  const [options, setOptions] = useState<OffenseFinderOptions>(DEFAULT_OFFENSE_OPTIONS);
  const { result, loading, progress, phase, error } = useOffenseFinder(myTeam, oppTeam, gen, options);

  const set = <K extends keyof OffenseFinderOptions>(key: K, value: OffenseFinderOptions[K]) =>
    setOptions((prev) => ({ ...prev, [key]: value }));

  const goalOptions = [4, 5, 6]
    .filter((g) => g <= Math.max(4, oppTeam.length))
    .map((g) => ({ value: g, label: `${g}+` }));

  return (
    <div className="glass rounded-card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-raised">
        <h3 className="font-display text-base font-semibold text-text-primary">Offense Finder</h3>
        <p className="font-body text-xs text-text-muted mt-0.5">
          The fewest attackers (2–4) whose Scarlet/Violet movesets OHKO the most of the opponent's team.
          Every hit is a real damage calc against their Smogon set and a build made to counter it.
        </p>
      </div>

      {/* Assumptions */}
      <div className="px-4 py-3 border-b border-surface-raised flex flex-wrap gap-x-6 gap-y-3">
        <Control label="KO must beat">
          <Segmented<DefenderMode>
            value={options.defenderMode}
            onChange={(v) => set("defenderMode", v)}
            options={(Object.keys(DEFENDER_MODES) as DefenderMode[]).map((k) => ({
              value: k, label: DEFENDER_MODES[k].label, title: DEFENDER_MODES[k].detail,
            }))}
          />
        </Control>
        <Control label="Counts as OHKO">
          <Segmented<KoThreshold>
            value={options.koThreshold}
            onChange={(v) => set("koThreshold", v)}
            options={[
              { value: "guaranteed", label: "Every roll" },
              { value: "likely", label: "≥50% of rolls" },
            ]}
          />
        </Control>
        <Control label="OHKO goal">
          <Segmented<number> value={options.goal} onChange={(v) => set("goal", v)} options={goalOptions} />
        </Control>
        <Control label="Field">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={options.weather}
              onChange={(e) => set("weather", e.target.value as WeatherOption)}
              className={selectClass}
            >
              <option value="">No weather</option>
              <option value="Sun">Sun</option>
              <option value="Rain">Rain</option>
              <option value="Sand">Sand</option>
              <option value="Snow">Snow</option>
            </select>
            <select
              value={options.terrain}
              onChange={(e) => set("terrain", e.target.value as TerrainOption)}
              className={selectClass}
            >
              <option value="">No terrain</option>
              <option value="Electric">Electric</option>
              <option value="Grassy">Grassy</option>
              <option value="Psychic">Psychic</option>
              <option value="Misty">Misty</option>
            </select>
            <Segmented<string>
              value={options.stealthRock ? "sr" : ""}
              onChange={(v) => set("stealthRock", v === "sr" ? !options.stealthRock : false)}
              options={[{ value: "sr", label: "Stealth Rock up", title: "Count Stealth Rock damage on switch-in" }]}
            />
          </div>
        </Control>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {loading && (
          <div className="flex flex-col gap-2 py-6 items-center">
            <p className="font-body text-sm text-text-secondary">
              {phase === "sets" ? "Fetching Smogon sets…" : "Running damage calcs…"}
            </p>
            <div className="w-full max-w-xs h-1.5 rounded-pill bg-surface-raised overflow-hidden">
              <div className="h-full gradient-accent transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </div>
        )}

        {error && !loading && (
          <p className="font-body text-sm text-orange-400 text-center py-6">Search failed: {error}</p>
        )}

        {result && !loading && (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <p className="font-body text-sm text-text-primary">
                {result.minMons !== null ? (
                  <>
                    <span className="font-semibold text-accent">{result.minMons} attackers</span> are enough to OHKO{" "}
                    {result.goal}+ of {result.targets.length}.
                  </>
                ) : (
                  <>
                    No group of up to 4 reaches {result.goal} OHKOs — best is{" "}
                    <span className="font-semibold text-orange-400">{result.bestCoverage}/{result.targets.length}</span>.
                  </>
                )}
              </p>
              <p className="font-body text-[11px] text-text-muted">
                {result.calcCount.toLocaleString()} calcs · hover a target for the full calc
              </p>
            </div>

            {result.unkoable.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-raised px-3 py-2">
                <span className="font-body text-xs text-text-secondary">Nothing on your team OHKOs:</span>
                {result.unkoable.map((t) => {
                  const p = result.targets[t].pokemon;
                  return (
                    <span key={t} className="flex items-center gap-1 font-body text-xs text-text-primary">
                      <img
                        src={p.icon}
                        alt=""
                        className="w-6 h-6 [image-rendering:pixelated]"
                        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getSpriteUrl(p.name); }}
                      />
                      {p.name}
                      {result.targets[t].ohkoBlockers.length > 0 && (
                        <span className="text-text-muted">({result.targets[t].ohkoBlockers.join("/")})</span>
                      )}
                    </span>
                  );
                })}
              </div>
            )}

            <TheirBuilds targets={result.targets} />

            {result.soloThreats.length > 0 && <SoloThreats sets={result.soloThreats} targets={result.targets} />}

            {result.loadouts.map((l, i) => (
              <LoadoutCard
                key={l.id}
                loadout={l}
                index={i}
                result={result}
                mode={options.defenderMode}
                gen={gen}
                level={options.level}
              />
            ))}

            <p className="font-body text-[11px] text-text-muted leading-relaxed">
              Assumes level {options.level} and 31 IVs. Their standard build is the first set from the most
              draft-like Smogon format that has one (252 HP neutral if none). The counter build keeps that
              item, maxes HP and the defense your hit targets with a + nature, and takes whichever ability is
              worst for you. Focus Sash, defensive Tera and Intimidate are ignored. Variable multi-hit moves use the calc's
              default hit count. Sturdy, Disguise and Ice Face block OHKOs unless the attacker has Mold Breaker.
              The Showdown link fills the calc's Import box — click <span className="text-text-secondary">Import</span>{" "}
              there, then pick the "Prep" sets from each side's dropdown.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
