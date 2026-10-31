import { useEffect, useMemo, useState } from "react";
import type { DraftPokemon } from "@/services/types";
import {
  coreCoverage,
  suggestCores,
  DEFAULT_DEFENSE_OPTIONS,
  type AttackerMode,
  type BulkMode,
  type DefenseFinderOptions,
  type DefenseFinderResult,
  type Hit,
  type Matchup,
  type MovePool,
  type RollMode,
  type SideBuild,
  type Verdict,
} from "@/services/defense-finder";
import type { TerrainOption, WeatherOption } from "@/services/damage";
import { TYPE_COLORS } from "@/services/type-utils";
import { useDefenseFinder } from "@/hooks/use-defense-finder";
import { Control, MonIcon, Segmented, selectClass, spreadText } from "./PrepControls";

interface DefenseFinderProps {
  myTeam: DraftPokemon[];
  oppTeam: DraftPokemon[];
  gen: number;
}

const MAX_CORE = 3;

const VERDICT_LABEL: Record<Verdict, string> = {
  counters: "Counters",
  checks: "Checks",
  "switch-in": "Switch-in only",
  loses: "Loses",
};

const VERDICT_DETAIL: Record<Verdict, string> = {
  counters: "Wins even after switching into the other side's best hit",
  checks: "Wins from a neutral start, but can't switch in",
  "switch-in": "Survives the switch-in hit and one more, but doesn't win",
  loses: "Loses the 1v1 and can't switch in safely",
};

/** Verdict colors — good when it's mine, bad when it's theirs */
const GOOD: Record<Verdict, string> = {
  counters: "bg-accent/20 text-accent",
  checks: "bg-accent/10 text-accent",
  "switch-in": "bg-amber-400/10 text-amber-300",
  loses: "bg-orange-500/10 text-orange-400",
};
const BAD: Record<Verdict, string> = {
  counters: "bg-orange-500/20 text-orange-400",
  checks: "bg-orange-500/10 text-orange-300",
  "switch-in": "bg-surface-raised text-text-secondary",
  loses: "bg-surface-raised text-text-muted",
};

function koLabel(hits: number): string {
  if (!Number.isFinite(hits)) return "no KO";
  return hits === 1 ? "OHKO" : `${hits}HKO`;
}

function pct(h: Hit): string {
  return `${h.minPercent.toFixed(0)}–${h.maxPercent.toFixed(0)}%`;
}

function MoveName({ hit }: { hit: Hit }) {
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-text-primary">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLORS[hit.moveType] ?? "#888" }} />
      {hit.move}
    </span>
  );
}

function speedLine(m: Matchup): string {
  if (m.firstBy === "priority") return m.theyMoveFirst ? "They move first (priority)" : "You move first (priority)";
  if (m.firstBy === "tie") return `Speed tie (${m.mySpeed}) — counted as them first`;
  return m.theyMoveFirst
    ? `They move first (${m.theirSpeed} vs ${m.mySpeed} Spe)`
    : `You move first (${m.mySpeed} vs ${m.theirSpeed} Spe)`;
}

/** Full breakdown of one pairing: both calcs, speed, and the race that decides the verdict */
function MatchupDetail({ m, result }: { m: Matchup; result: DefenseFinderResult }) {
  const opp = result.opp[m.oppIndex].pokemon;
  const mine = result.mine[m.myIndex].pokemon;
  const tags = (h: Hit) => [
    ...(h.usesTera ? [`Tera ${h.moveType}`] : []),
    ...(h.accuracy < 100 ? [`${h.accuracy}% accurate`] : []),
    ...h.tags,
  ];
  return (
    <div className="rounded-lg bg-surface-raised px-3 py-2.5 flex flex-col gap-2 font-body text-[11px]">
      <div className="flex flex-wrap items-center gap-2">
        <MonIcon mon={mine} />
        <span className="text-text-primary font-semibold">{mine.name}</span>
        <span className={`px-2 py-0.5 rounded-pill ${GOOD[m.you]}`} title={VERDICT_DETAIL[m.you]}>
          {VERDICT_LABEL[m.you]}
        </span>
        <span className="text-text-muted">vs</span>
        <MonIcon mon={opp} />
        <span className="text-text-primary font-semibold">{opp.name}</span>
        <span className="text-text-muted">· {speedLine(m)}</span>
      </div>
      {([
        ["They hit you", m.theirHit, m.theirHits, true],
        ["You hit them", m.myHit, m.myHits, false],
      ] as const).map(([label, h, hits, theirs]) => (
        <div key={label} className="flex flex-col gap-0.5">
          <span className="text-text-secondary">
            <span className="uppercase tracking-wider text-[10px] text-text-muted mr-1.5">{label}</span>
            {h ? (
              <>
                <MoveName hit={h} /> {pct(h)} → <span className="text-text-primary">{koLabel(hits)}</span>
                {tags(h).length > 0 && <span className="text-amber-300"> · {tags(h).join(" · ")}</span>}
              </>
            ) : (
              <span className="text-text-muted">No damaging move {theirs ? "they" : "you"} can use</span>
            )}
          </span>
          {h && <span className="font-mono text-[10px] text-text-muted leading-snug">{h.desc}</span>}
        </div>
      ))}
      <p className="text-text-secondary">
        They need {koLabel(m.theirHits) === "no KO" ? "more than 9 hits" : `${m.theirHits} hit${m.theirHits === 1 ? "" : "s"}`},
        you need {koLabel(m.myHits) === "no KO" ? "more than 9" : m.myHits}; {m.theyMoveFirst ? "they" : "you"} move first.
        {" "}{VERDICT_DETAIL[m.you]}.
      </p>
    </div>
  );
}

/** Opponent rows × my columns, from their side: who they beat and how hard they hit */
function ThreatGrid({
  result,
  selected,
  onSelect,
}: {
  result: DefenseFinderResult;
  selected: Matchup | null;
  onSelect: (m: Matchup) => void;
}) {
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="border-separate border-spacing-1 font-body text-[11px]">
        <thead>
          <tr>
            <th className="sticky left-0 bg-surface z-10" />
            {result.mine.map((s) => (
              <th key={s.pokemon.id} className="font-normal text-text-muted px-1">
                <div className="flex flex-col items-center gap-0.5 w-20">
                  <MonIcon mon={s.pokemon} className="w-8 h-8" />
                  <span className="leading-tight text-center truncate w-full">{s.pokemon.name}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.threatOrder.map((t) => {
            const row = result.matchups[t];
            const beats = row.filter((m) => m.them === "counters" || m.them === "checks").length;
            const ohkos = row.filter((m) => m.theirHits === 1).length;
            return (
              <tr key={t}>
                <th className="sticky left-0 bg-surface z-10 font-normal text-left pr-2">
                  <div className="flex items-center gap-1.5 w-24 sm:w-32">
                    <MonIcon mon={result.opp[t].pokemon} className="w-8 h-8" />
                    <div className="flex flex-col leading-tight min-w-0">
                      <span className="text-text-primary truncate">{result.opp[t].pokemon.name}</span>
                      <span className="text-text-muted text-[10px]">
                        Beats {beats}/{row.length}{ohkos > 0 && ` · ${ohkos} OHKO`}
                      </span>
                    </div>
                  </div>
                </th>
                {row.map((m) => {
                  const active = selected?.oppIndex === m.oppIndex && selected?.myIndex === m.myIndex;
                  return (
                    <td key={m.myIndex} className="p-0">
                      <button
                        onClick={() => onSelect(m)}
                        title={VERDICT_DETAIL[m.them]}
                        className={`w-20 rounded-lg px-1.5 py-1 flex flex-col items-center gap-0.5 transition-shadow ${BAD[m.them]} ${
                          active ? "ring-1 ring-accent" : "hover:ring-1 hover:ring-text-muted"
                        }`}
                      >
                        <span className="font-semibold leading-tight">
                          {m.them === "loses" ? "—" : VERDICT_LABEL[m.them]}
                        </span>
                        {m.theirHit ? (
                          <span className="font-mono text-[10px] text-text-primary leading-tight">
                            {m.theirHit.maxPercent.toFixed(0)}% · {koLabel(m.theirHits)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-text-muted">no damage</span>
                        )}
                        <span className="text-[9px] text-text-muted leading-tight">
                          {m.theyMoveFirst ? "they're first" : "you're first"}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BuildRow({ side, line }: { side: SideBuild; line: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 font-body text-[11px]">
      <MonIcon mon={side.pokemon} />
      <span className="text-text-primary w-24 shrink-0 pt-0.5">{side.pokemon.name}</span>
      <span className="text-text-secondary pt-0.5">{line}</span>
    </div>
  );
}

function standardLine(side: SideBuild, speed: number) {
  const s = side.standard;
  const source = side.smogonSet
    ? `${side.smogonSet.format} "${side.smogonSet.name}"`
    : <span className="text-amber-300">No Smogon set — fallback</span>;
  return (
    <>
      {source} · {s.nature} {spreadText(s.evs)}
      {s.item && ` @ ${s.item}`} · {s.ability || "worst-case ability"} · {speed} Spe · {side.movePoolSize} moves
    </>
  );
}

function Builds({ result, options }: { result: DefenseFinderResult; options: DefenseFinderOptions }) {
  const missing = [...result.opp, ...result.mine].filter((s) => !s.smogonSet).length;
  return (
    <details className="rounded-lg bg-surface-raised px-3 py-2">
      <summary className="font-body text-xs text-text-secondary cursor-pointer select-none">
        Builds used in every calc
        {missing > 0 && <span className="text-amber-300"> · {missing} without a Smogon set</span>}
      </summary>
      <div className="flex flex-col gap-1.5 mt-2">
        <span className="font-body text-[10px] uppercase tracking-widest text-text-muted">
          Their attackers ({options.attackerMode === "max" ? "max offense" : "Smogon set"}) — also their bulk when you hit back
        </span>
        {result.opp.map((s) => (
          <BuildRow
            key={s.pokemon.id}
            side={s}
            line={
              options.attackerMode === "max" ? (
                <>
                  Attacks: Adamant / Modest 252 Atk or SpA / 252 Spe @ Choice Band / Specs ({s.maxOffenseSpeed} Spe)
                  {s.pokemon.isTeraCaptain && options.oppTera && " · may Tera"} · Bulk: {standardLine(s, s.speed)}
                </>
              ) : (
                <>
                  {standardLine(s, s.speed)}
                  {s.pokemon.isTeraCaptain && options.oppTera && " · may Tera"}
                </>
              )
            }
          />
        ))}
        <span className="font-body text-[10px] uppercase tracking-widest text-text-muted mt-1">
          Your team ({options.bulkMode === "max" ? "max bulk on defense" : "Smogon set"}) — always your Smogon set when attacking
        </span>
        {result.mine.map((s) => (
          <BuildRow
            key={s.pokemon.id}
            side={s}
            line={
              <>
                {standardLine(s, s.speed)}
                {options.bulkMode === "max" && " · Bulk: 252 HP / 252+ Def or SpD (Bold / Calm), same item"}
              </>
            }
          />
        ))}
      </div>
    </details>
  );
}

function CoreCell({ m, active, onSelect }: { m: Matchup; active: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-lg bg-surface-raised px-2 py-1.5 flex flex-col gap-0.5 font-body text-[11px] ${
        active ? "ring-1 ring-accent" : "hover:ring-1 hover:ring-text-muted"
      }`}
    >
      <span className={`self-start px-2 py-0.5 rounded-pill font-semibold ${GOOD[m.you]}`} title={VERDICT_DETAIL[m.you]}>
        {VERDICT_LABEL[m.you]}
      </span>
      <span className="text-text-secondary leading-snug">
        Takes{" "}
        {m.theirHit ? (
          <><MoveName hit={m.theirHit} /> <span className="font-mono text-text-primary">{pct(m.theirHit)}</span> · {koLabel(m.theirHits)}</>
        ) : "nothing"}
      </span>
      <span className="text-text-secondary leading-snug">
        Hits{" "}
        {m.myHit ? (
          <><MoveName hit={m.myHit} /> <span className="font-mono text-text-primary">{pct(m.myHit)}</span> · {koLabel(m.myHits)}</>
        ) : "nothing"}
      </span>
      <span className={`text-[10px] ${m.theyMoveFirst ? "text-orange-400" : "text-accent"}`}>
        {m.theyMoveFirst ? "They move first" : "You move first"}
      </span>
    </button>
  );
}

function DefensiveCore({ result }: { result: DefenseFinderResult }) {
  const names = result.mine.map((s) => s.pokemon.name);
  const suggestions = useMemo(
    () => (result.mine.length >= 2 ? suggestCores(result, 2, 3) : []),
    [result],
  );
  // Kept by name so roster exclusions don't shift the picks
  const [picked, setPicked] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<Matchup | null>(null);
  const members = (picked ?? suggestions[0]?.members.map((i) => names[i]) ?? [])
    .map((n) => names.indexOf(n))
    .filter((i) => i >= 0);
  const coverage = coreCoverage(result, members);

  useEffect(() => setSelected(null), [result]);

  function toggle(i: number) {
    const current = members.map((m) => names[m]);
    const name = names[i];
    if (current.includes(name)) setPicked(current.filter((n) => n !== name));
    else if (current.length < MAX_CORE) setPicked([...current, name]);
  }

  const total = result.opp.length;
  const coreKey = (ms: number[]) => [...ms].sort().join(",");

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h4 className="font-display text-sm font-semibold text-text-primary">Defensive core</h4>
        <p className="font-body text-xs text-text-muted mt-0.5">
          Pick up to {MAX_CORE} of your Pokémon to see how each answers their threats.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {result.mine.map((s, i) => {
          const on = members.includes(i);
          return (
            <button
              key={s.pokemon.id}
              onClick={() => toggle(i)}
              disabled={!on && members.length >= MAX_CORE}
              className={`flex items-center gap-1 pl-1 pr-2.5 py-0.5 rounded-pill font-body text-[11px] transition-colors ${
                on
                  ? "bg-accent/20 text-accent font-semibold"
                  : "text-text-secondary hover:bg-surface-raised disabled:opacity-40 disabled:hover:bg-transparent"
              }`}
            >
              <MonIcon mon={s.pokemon} />
              {s.pokemon.name}
            </button>
          );
        })}
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 font-body text-[11px]">
          <span className="text-text-muted">Best pairs:</span>
          {suggestions.map((c) => (
            <button
              key={coreKey(c.members)}
              onClick={() => setPicked(c.members.map((i) => names[i]))}
              className={`px-2.5 py-0.5 rounded-pill transition-colors ${
                coreKey(c.members) === coreKey(members)
                  ? "bg-accent/20 text-accent"
                  : "text-text-secondary hover:bg-surface-raised"
              }`}
              title={`Counters ${c.countered}, counters or checks ${c.answered} of ${total}`}
            >
              {c.members.map((i) => names[i]).join(" + ")}{" "}
              <span className="text-text-muted">({c.countered} counter · {c.answered} answer)</span>
            </button>
          ))}
        </div>
      )}

      {members.length > 0 && (
        <>
          <p className="font-body text-sm text-text-primary">
            <span className="font-semibold text-accent">Counters {coverage.countered}/{total}</span>
            {coverage.answered > coverage.countered && <>, checks {coverage.answered - coverage.countered} more</>}
            {coverage.switchIns > 0 && <>, {coverage.switchIns} switch-in only</>}
            {coverage.uncovered.length > 0 ? (
              <>
                {" · "}
                <span className="text-orange-400">
                  No answer to {coverage.uncovered.map((t) => result.opp[t].pokemon.name).join(", ")}
                </span>
              </>
            ) : (
              <> · every threat has an answer</>
            )}
          </p>

          <div className="overflow-x-auto -mx-4 px-4">
            <table className="border-separate border-spacing-1 w-full">
              <thead>
                <tr>
                  <th />
                  {members.map((i) => (
                    <th key={i} className="font-body text-[11px] font-normal text-text-secondary min-w-44">
                      <div className="flex items-center gap-1">
                        <MonIcon mon={result.mine[i].pokemon} />
                        {result.mine[i].pokemon.name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.threatOrder.map((t) => {
                  const uncovered = coverage.uncovered.includes(t);
                  return (
                    <tr key={t}>
                      <th className="font-normal text-left align-top pt-1.5">
                        <div className="flex items-center gap-1.5 w-28 font-body text-[11px]">
                          <MonIcon mon={result.opp[t].pokemon} className="w-8 h-8" />
                          <span className={`leading-tight ${uncovered ? "text-orange-400" : "text-text-primary"}`}>
                            {result.opp[t].pokemon.name}
                          </span>
                        </div>
                      </th>
                      {members.map((i) => {
                        const m = result.matchups[t][i];
                        return (
                          <td key={i} className="align-top">
                            <CoreCell
                              m={m}
                              active={selected?.oppIndex === t && selected?.myIndex === i}
                              onSelect={() => setSelected(m)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selected && members.includes(selected.myIndex) && <MatchupDetail m={selected} result={result} />}
        </>
      )}
    </div>
  );
}

export function DefenseFinder({ myTeam, oppTeam, gen }: DefenseFinderProps) {
  const [options, setOptions] = useState<DefenseFinderOptions>(DEFAULT_DEFENSE_OPTIONS);
  const { result, loading, progress, phase, error } = useDefenseFinder(myTeam, oppTeam, gen, options);
  const [selected, setSelected] = useState<Matchup | null>(null);

  const set = <K extends keyof DefenseFinderOptions>(key: K, value: DefenseFinderOptions[K]) =>
    setOptions((prev) => ({ ...prev, [key]: value }));

  useEffect(() => setSelected(null), [result]);

  return (
    <div className="glass rounded-card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-raised">
        <h3 className="font-display text-base font-semibold text-text-primary">Defense Finder</h3>
        <p className="font-body text-xs text-text-muted mt-0.5">
          Every one of their Pokémon against every one of yours, calced both ways: their hardest hit into you, your
          hardest hit back, and who moves first. A matchup is theirs when they win the race — a counter wins even after
          switching in.
        </p>
      </div>

      {/* Assumptions */}
      <div className="px-4 py-3 border-b border-surface-raised flex flex-wrap gap-x-6 gap-y-3">
        <Control label="Their attackers">
          <Segmented<AttackerMode>
            value={options.attackerMode}
            onChange={(v) => set("attackerMode", v)}
            options={[
              { value: "standard", label: "Smogon set", title: "Their standard Smogon set's nature, EVs, item and ability" },
              { value: "max", label: "Max offense", title: "252+ Atk or SpA, Choice Band / Specs, best ability" },
            ]}
          />
        </Control>
        <Control label="Your bulk">
          <Segmented<BulkMode>
            value={options.bulkMode}
            onChange={(v) => set("bulkMode", v)}
            options={[
              { value: "standard", label: "Smogon set", title: "Your Smogon set's spread" },
              { value: "max", label: "Max bulk", title: "252 HP / 252+ in the defense each hit targets, same item" },
            ]}
          />
        </Control>
        <Control label="Moves">
          <Segmented<MovePool>
            value={options.movePool}
            onChange={(v) => set("movePool", v)}
            options={[
              { value: "learnset", label: "Anything learnable", title: "Every damaging move in the gen's learnset" },
              { value: "smogon", label: "Smogon set moves", title: "Only the moves in each Smogon set (learnset if none)" },
            ]}
          />
        </Control>
        <Control label="KO rolls">
          <Segmented<RollMode>
            value={options.rolls}
            onChange={(v) => set("rolls", v)}
            options={[
              { value: "worst", label: "Worst case", title: "Their KO counts if any roll does it; yours only if every roll does" },
              { value: "likely", label: "≥50% of rolls", title: "A KO counts for either side at ≥50% of rolls" },
            ]}
          />
        </Control>
        <Control label="Their Tera">
          <Segmented<string>
            value={options.oppTera ? "on" : "off"}
            onChange={(v) => set("oppTera", v === "on")}
            options={[
              { value: "on", label: "Captains Tera", title: "Their Tera captains may Tera into their move's type" },
              { value: "off", label: "No Tera" },
            ]}
          />
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
          <p className="font-body text-sm text-orange-400 text-center py-6">Calcs failed: {error}</p>
        )}

        {result && !loading && (
          <>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <h4 className="font-display text-sm font-semibold text-text-primary">Their best matchups</h4>
                <p className="font-body text-[11px] text-text-muted">
                  Biggest threats first · cell: their verdict, hardest hit (max roll) and KO count · tap a cell for the
                  calcs · {result.calcCount.toLocaleString()} calcs
                </p>
              </div>
              <ThreatGrid result={result} selected={selected} onSelect={setSelected} />
              {selected && <MatchupDetail m={selected} result={result} />}
            </div>

            <Builds result={result} options={options} />

            <DefensiveCore result={result} />

            <p className="font-body text-[11px] text-text-muted leading-relaxed">
              Assumes level {options.level}, 31 IVs, full HP, and one attack per turn with no switching, boosting,
              status or recovery moves. The verdict is a turn race: each side's KO count comes from the calc
              (Leftovers and other end-of-turn effects included) for its hardest-hitting move: their highest max roll,
              your highest min roll, each weighted by accuracy and halved for conditional moves like Sucker Punch.
              Multiscale and Tera Shell only soften the first hit. Speed uses each standard build with Choice Scarf and Booster Energy; ties go to them, and
              priority beats Speed. Without a Smogon set a Pokémon gets 252 HP / 252 in its better attacking stat,
              neutral nature, and the ability worst for you. Self-KO and recharge moves, Focus Sash, your Tera and
              Intimidate are ignored. "Counters" assumes you switch in on their hardest hit.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
