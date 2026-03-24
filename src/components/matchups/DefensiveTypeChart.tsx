import type { DraftPokemon } from "@/services/types";
import { ALL_TYPES } from "@/services/matchup-calc";
import { TYPE_COLORS } from "@/services/type-utils";
import { generations, getSpriteUrl } from "@/services/pokemon-data";
import { Tooltip } from "@/components/ui/Tooltip";

interface DefensiveTypeChartProps {
  myTeam: DraftPokemon[];
  oppTeam: DraftPokemon[];
  myTeamName: string;
  oppTeamName: string;
  gen: number;
}

function cellStyle(mult: number): { label: string; className: string } {
  if (mult === 0)    return { label: "✕",  className: "bg-purple-500/20 text-purple-300 font-bold" };
  if (mult === 0.25) return { label: "¼×", className: "bg-green-500/25 text-green-300 font-bold" };
  if (mult === 0.5)  return { label: "½×", className: "bg-green-500/15 text-green-400" };
  if (mult === 1)    return { label: "—",  className: "text-text-muted/40" };
  if (mult === 2)    return { label: "2×", className: "bg-red-500/15 text-red-400" };
  if (mult === 4)    return { label: "4×", className: "bg-red-500/30 text-red-300 font-bold" };
  return { label: `${mult}×`, className: "text-text-muted" };
}

function netStyle(score: number): string {
  if (score > 0) return "text-red-400 font-bold";
  if (score < 0) return "text-green-400 font-bold";
  return "text-text-muted";
}

function netLabel(score: number): string {
  if (score > 0) return `+${score}`;
  if (score === 0) return "0";
  return String(score);
}

interface TypeBreakdown {
  critWeak: string[];
  weak: string[];
  resist: string[];
  deepResist: string[];
  immune: string[];
}

function NetTooltip({ breakdown }: { breakdown: TypeBreakdown }) {
  const sections: { label: string; names: string[]; className: string }[] = [
    { label: "Critically Weak (4×)", names: breakdown.critWeak,   className: "text-red-300" },
    { label: "Weak (2×)",            names: breakdown.weak,        className: "text-red-400" },
    { label: "Resistant (½×)",       names: breakdown.resist,      className: "text-green-400" },
    { label: "Deeply Resistant (¼×)",names: breakdown.deepResist,  className: "text-green-300" },
    { label: "Immune",               names: breakdown.immune,      className: "text-purple-300" },
  ].filter((s) => s.names.length > 0);

  if (sections.length === 0) {
    return <span className="text-text-muted">All neutral</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      {sections.map((s) => (
        <div key={s.label}>
          <span className={`font-bold ${s.className}`}>{s.label}: </span>
          <span className="text-text-secondary">{s.names.join(", ")}</span>
        </div>
      ))}
    </div>
  );
}

function TeamChart({
  team,
  teamName,
  gen,
}: {
  team: DraftPokemon[];
  teamName: string;
  gen: number;
}) {
  if (team.length === 0) return null;

  const generation = generations.get(gen);

  const matrix = team.map((p) =>
    ALL_TYPES.map(
      (type) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        generation.types.totalEffectiveness(type as any, p.types as any) as number,
    ),
  );

  const netData = ALL_TYPES.map((_, ti) => {
    const breakdown: TypeBreakdown = { critWeak: [], weak: [], resist: [], deepResist: [], immune: [] };
    let score = 0;
    for (let pi = 0; pi < team.length; pi++) {
      const mult = matrix[pi][ti];
      if (mult === 4)    { breakdown.critWeak.push(team[pi].name);   score += 1; }
      else if (mult === 2)    { breakdown.weak.push(team[pi].name);       score += 1; }
      else if (mult === 0.5)  { breakdown.resist.push(team[pi].name);     score -= 1; }
      else if (mult === 0.25) { breakdown.deepResist.push(team[pi].name); score -= 1; }
      else if (mult === 0)    { breakdown.immune.push(team[pi].name);     score -= 1; }
    }
    return { score, breakdown };
  });

  return (
    <div>
      <div className="px-4 py-2 border-b border-surface-raised">
        <h4 className="font-display text-sm font-semibold text-text-primary">{teamName}</h4>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              {/* Pokémon name column header */}
              <th className="px-3 py-2 text-left font-mono text-text-muted sticky left-0 bg-surface-overlay z-10 min-w-[120px]">
                Pokémon
              </th>
              {ALL_TYPES.map((type) => (
                <th key={type} className="px-1 py-2 text-center font-mono min-w-[36px]">
                  <div
                    className="mx-auto px-1 py-0.5 rounded text-[9px] font-bold uppercase leading-none text-white"
                    style={{ backgroundColor: TYPE_COLORS[type] ?? "#888" }}
                  >
                    {type.slice(0, 3)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {team.map((p, pi) => (
              <tr
                key={p.id}
                className={`border-t border-surface-raised/40 ${pi % 2 === 0 ? "" : "bg-surface-raised/20"}`}
              >
                <td className="px-3 py-1.5 sticky left-0 bg-inherit z-10">
                  <div className="flex items-center gap-1.5">
                    <img
                      src={p.icon}
                      alt={p.name}
                      className="w-5 h-5 [image-rendering:pixelated] shrink-0"
                      onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getSpriteUrl(p.name); }}
                    />
                    <span className="font-body text-text-secondary whitespace-nowrap">{p.name}</span>
                  </div>
                </td>
                {matrix[pi].map((mult, ti) => {
                  const { label, className } = cellStyle(mult);
                  return (
                    <td
                      key={ti}
                      className={`px-1 py-1.5 text-center font-mono ${className}`}
                      title={`${ALL_TYPES[ti]} → ${mult}×`}
                    >
                      {label}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-surface-raised">
              <td className="px-3 py-2 sticky left-0 bg-surface-overlay z-10">
                <span className="font-mono text-[10px] text-text-muted uppercase tracking-wide">
                  Net
                </span>
              </td>
              {netData.map(({ score, breakdown }, ti) => (
                <td key={ti} className="px-1 py-2 text-center">
                  <Tooltip content={<NetTooltip breakdown={breakdown} />}>
                    <span className={`font-mono text-[11px] cursor-default ${netStyle(score)}`}>
                      {netLabel(score)}
                    </span>
                  </Tooltip>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export function DefensiveTypeChart({
  myTeam,
  oppTeam,
  myTeamName,
  oppTeamName,
  gen,
}: DefensiveTypeChartProps) {
  if (myTeam.length === 0 && oppTeam.length === 0) {
    return (
      <div className="glass rounded-card p-6 text-center">
        <p className="font-body text-text-muted text-sm">No active Pokémon to analyze.</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-card overflow-hidden flex flex-col gap-0">
      <div className="px-4 py-3 border-b border-surface-raised">
        <h3 className="font-display text-base font-semibold text-text-primary">
          Defensive Type Chart
        </h3>
        <p className="font-mono text-xs text-text-muted mt-0.5">
          Net = weaknesses − resistances &amp; immunities
        </p>
      </div>

      <TeamChart team={myTeam} teamName={myTeamName} gen={gen} />

      {myTeam.length > 0 && oppTeam.length > 0 && (
        <div className="border-t-2 border-surface-raised" />
      )}

      <TeamChart team={oppTeam} teamName={oppTeamName} gen={gen} />
    </div>
  );
}
