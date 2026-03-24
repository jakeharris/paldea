import { useState, useMemo } from "react";
import type { DraftPokemon } from "@/services/types";
import {
  calcSpeed,
  minEvsToOutspeed,
  type SpeedCalcOptions,
} from "@/services/matchup-calc";
import { getSpriteUrl } from "@/services/pokemon-data";

interface SpeedTierToolProps {
  myTeam: DraftPokemon[];
  oppTeam: DraftPokemon[];
  myTeamName: string;
  oppTeamName: string;
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[11px] font-mono px-2.5 py-1 rounded-pill transition-colors ${
        active
          ? "bg-accent/20 text-accent"
          : "text-text-muted hover:text-text-secondary hover:bg-surface-raised"
      }`}
    >
      {children}
    </button>
  );
}

export function SpeedTierTool({ myTeam, oppTeam, myTeamName, oppTeamName }: SpeedTierToolProps) {
  const [selectedMyMon, setSelectedMyMon] = useState<string>("");
  const [oppScarf, setOppScarf] = useState(false);
  const [oppStage, setOppStage] = useState(0);
  const [myScarf, setMyScarf] = useState(false);
  const [myStage, setMyStage] = useState(0);

  const selectedMon = useMemo(
    () => myTeam.find((p) => p.name === selectedMyMon) ?? null,
    [myTeam, selectedMyMon],
  );

  const creepRows = useMemo(() => {
    if (!selectedMon) return [];
    return oppTeam.map((opp) => {
      const base = selectedMon.baseStats.spe;
      const oppBase = opp.baseStats.spe;
      const myOpts: SpeedCalcOptions = { plusNature: false, scarf: myScarf, speedStage: myStage };

      function ev(target: number): string {
        const result = minEvsToOutspeed(base, target, myOpts);
        if (result === null) {
          if (calcSpeed(base, 0, myOpts) > target) return "0";
          return "Can't";
        }
        return String(result);
      }

      const oppOpts = (plusNature: boolean): SpeedCalcOptions => ({
        plusNature,
        scarf: oppScarf,
        speedStage: oppStage,
      });

      return {
        opp,
        ev0: ev(calcSpeed(oppBase, 0, oppOpts(false))),
        ev252Neutral: ev(calcSpeed(oppBase, 252, oppOpts(false))),
        ev252Plus: ev(calcSpeed(oppBase, 252, oppOpts(true))),
      };
    });
  }, [selectedMon, oppTeam, oppScarf, oppStage, myScarf, myStage]);

  return (
    <div className="glass rounded-card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-raised">
        <h3 className="font-display text-base font-semibold text-text-primary">
          Speed Tiers
        </h3>
        <p className="font-mono text-xs text-text-muted mt-0.5">
          All active Pokémon sorted by base speed
        </p>
      </div>

      {/* Speed tier comparison */}
      <div className="border-b border-surface-raised grid grid-cols-2 divide-x divide-surface-raised">
        {/* My team: name | speed */}
        <div>
          <div className="px-3 py-1.5 border-b border-surface-raised/60">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-teal-400">{myTeamName}</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-raised/40">
                <th className="px-3 py-1.5 text-left font-mono text-[10px] text-text-muted">Pokémon</th>
                <th className="px-3 py-1.5 text-right font-mono text-[10px] text-text-muted">Base Spe</th>
              </tr>
            </thead>
            <tbody>
              {[...myTeam].sort((a, b) => b.baseStats.spe - a.baseStats.spe).map((p, i) => (
                <tr key={p.id} className={`border-b border-surface-raised/30 ${i % 2 === 0 ? "" : "bg-surface-raised/20"}`}>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <img src={p.icon} alt={p.name} className="w-4 h-4 [image-rendering:pixelated]" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getSpriteUrl(p.name); }} />
                      <span className="font-body text-text-secondary">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-text-primary font-semibold">{p.baseStats.spe}</td>
                </tr>
              ))}
              {myTeam.length === 0 && (
                <tr><td colSpan={2} className="px-3 py-4 text-center font-body text-text-muted">No Pokémon.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Opponent: speed | name */}
        <div>
          <div className="px-3 py-1.5 border-b border-surface-raised/60">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-orange-400">{oppTeamName}</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-raised/40">
                <th className="px-3 py-1.5 text-left font-mono text-[10px] text-text-muted">Base Spe</th>
                <th className="px-3 py-1.5 text-right font-mono text-[10px] text-text-muted">Pokémon</th>
              </tr>
            </thead>
            <tbody>
              {[...oppTeam].sort((a, b) => b.baseStats.spe - a.baseStats.spe).map((p, i) => (
                <tr key={p.id} className={`border-b border-surface-raised/30 ${i % 2 === 0 ? "" : "bg-surface-raised/20"}`}>
                  <td className="px-3 py-1.5 font-mono text-text-primary font-semibold">{p.baseStats.spe}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="font-body text-text-secondary">{p.name}</span>
                      <img src={p.icon} alt={p.name} className="w-4 h-4 [image-rendering:pixelated]" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getSpriteUrl(p.name); }} />
                    </div>
                  </td>
                </tr>
              ))}
              {oppTeam.length === 0 && (
                <tr><td colSpan={2} className="px-3 py-4 text-center font-body text-text-muted">No Pokémon.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Speed Creep Calculator */}
      <div className="p-4">
        <h4 className="font-display text-sm font-semibold text-text-primary mb-3">
          Speed Creep Calculator
        </h4>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-4">
          <div className="flex items-center gap-2">
            <label className="font-mono text-xs text-text-muted">My Pokémon:</label>
            <select
              value={selectedMyMon}
              onChange={(e) => setSelectedMyMon(e.target.value)}
              className="bg-surface-raised text-text-primary font-body text-xs rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent border border-surface-raised"
            >
              <option value="">— Select —</option>
              {myTeam.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name} (base {p.baseStats.spe})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-text-muted">My:</span>
            <ToggleButton active={myScarf} onClick={() => setMyScarf((v) => !v)}>
              Scarf
            </ToggleButton>
            <label className="font-mono text-xs text-text-muted">Stage:</label>
            <input
              type="number"
              min={-6}
              max={6}
              value={myStage}
              onChange={(e) => setMyStage(Math.max(-6, Math.min(6, Number(e.target.value))))}
              className="w-12 bg-surface-raised text-text-primary font-mono text-xs text-center rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-accent border border-surface-raised/60"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-text-muted">Opp:</span>
            <ToggleButton active={oppScarf} onClick={() => setOppScarf((v) => !v)}>
              Scarf
            </ToggleButton>
            <label className="font-mono text-xs text-text-muted">Stage:</label>
            <input
              type="number"
              min={-6}
              max={6}
              value={oppStage}
              onChange={(e) => setOppStage(Math.max(-6, Math.min(6, Number(e.target.value))))}
              className="w-12 bg-surface-raised text-text-primary font-mono text-xs text-center rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-accent border border-surface-raised/60"
            />
          </div>
        </div>

        {selectedMon && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-raised">
                  <th className="px-3 py-2 text-left font-mono text-xs text-text-muted">Opponent</th>
                  <th className="px-3 py-2 text-right font-mono text-xs text-text-muted">Base</th>
                  <th className="px-3 py-2 text-right font-mono text-xs text-text-muted">Beat 0 EV</th>
                  <th className="px-3 py-2 text-right font-mono text-xs text-text-muted">Beat 252 Neu</th>
                  <th className="px-3 py-2 text-right font-mono text-xs text-text-muted">Beat 252 +Spe</th>
                </tr>
              </thead>
              <tbody>
                {creepRows.map((row, i) => (
                  <tr
                    key={row.opp.id}
                    className={`border-b border-surface-raised/50 ${i % 2 === 0 ? "" : "bg-surface-raised/20"}`}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <img
                          src={row.opp.icon}
                          alt={row.opp.name}
                          className="w-5 h-5 [image-rendering:pixelated]"
                          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getSpriteUrl(row.opp.name); }}
                        />
                        <span className="font-body text-xs text-text-primary">{row.opp.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-text-secondary">
                      {row.opp.baseStats.spe}
                    </td>
                    {[row.ev0, row.ev252Neutral, row.ev252Plus].map((val, j) => (
                      <td key={j} className={`px-3 py-2 text-right font-mono text-xs ${
                        val === "Can't" ? "text-red-400" : val === "0" ? "text-green-400" : "text-text-muted"
                      }`}>
                        {val === "Can't" ? "Can't" : val === "0" ? "0 EVs" : `${val} EVs`}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!selectedMon && (
          <p className="font-body text-text-muted text-sm text-center py-4">
            Select one of your Pokémon above to see speed creep targets.
          </p>
        )}
      </div>
    </div>
  );
}
