import { ATTACK_NATURES, counterSpread, type DefenderMode } from "./damage";
import type { AttackerSet, DefenderSpread, Loadout, OffenseFinderResult, TargetInfo } from "./offense-finder";

/**
 * Showdown paste export for Offense Finder loadouts.
 *
 * calc.pokemonshowdown.com reads `?import=<base64 paste>` into its Import box
 * (the user still clicks "Import"). A "Nickname (Species)" header becomes the
 * custom set's name in the calc's dropdown, so nicknames must never be a
 * species name themselves.
 */

export const SHOWDOWN_CALC_URL = "https://calc.pokemonshowdown.com/";

const STAT_LABELS = { hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" } as const;
type StatKey = keyof typeof STAT_LABELS;

/** Strip accents so the paste survives atob() as Latin-1 (Flabébé → Flabebe) */
function ascii(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function evLine(evs: Partial<Record<StatKey, number>>): string {
  const parts = (Object.keys(STAT_LABELS) as StatKey[])
    .filter((k) => (evs[k] ?? 0) > 0)
    .map((k) => `${evs[k]} ${STAT_LABELS[k]}`);
  return parts.length ? `EVs: ${parts.join(" / ")}` : "";
}

export function attackerSetPaste(set: AttackerSet, label: string, level = 100): string {
  const focus = ATTACK_NATURES[set.nature].focus;
  const lines = [
    `${ascii(label)} (${ascii(set.pokemon.name)})${set.item ? ` @ ${set.item}` : ""}`,
    `Ability: ${set.ability}`,
    level !== 100 ? `Level: ${level}` : "",
    set.teraType ? `Tera Type: ${set.teraType}` : "",
    evLine({ hp: 4, [focus]: 252, spe: 252 }),
    `${set.nature} Nature`,
    ...set.moves.map((m) => `- ${m}`),
  ];
  return lines.filter(Boolean).join("\n");
}

/** One defender build exactly as the finder calced it */
export function defenderPaste(
  target: TargetInfo,
  spread: DefenderSpread,
  label: string,
  moves: string[] = [],
  level = 100,
): string {
  const lines = [
    `${ascii(label)} (${ascii(target.pokemon.name)})${spread.item ? ` @ ${spread.item}` : ""}`,
    spread.ability ? `Ability: ${spread.ability}` : "",
    level !== 100 ? `Level: ${level}` : "",
    evLine(spread.evs),
    `${spread.nature} Nature`,
    ...moves.map((m) => `- ${m}`),
  ];
  return lines.filter(Boolean).join("\n");
}

/** Full paste for one loadout: my sets, then each opponent build that was checked */
export function loadoutPaste(
  loadout: Loadout,
  loadoutNumber: number,
  result: OffenseFinderResult,
  mode: DefenderMode,
  level = 100,
): string {
  const mine = loadout.sets.map((s) =>
    attackerSetPaste(s, `Prep ${loadoutNumber} ${s.nature}${s.teraType ? ` Tera ${s.teraType}` : ""}`, level),
  );
  const categories = new Set(loadout.sets.flatMap((s) => s.kos.map((h) => h.category)));

  const theirs: string[] = [];
  for (const cov of loadout.coverage) {
    const target = result.targets[cov.targetIndex];
    const hits = cov.hits.map((h) => h.hit);

    if (mode !== "counter") {
      // An unpinned ability was worst-cased per hit — export the one the best hit met
      const ability = target.standard.ability || hits[0]?.vs.standard?.ability || target.abilityCandidates[0];
      theirs.push(defenderPaste(
        target,
        { ...target.standard, ability },
        target.smogonSet ? "Prep Smogon" : "Prep Standard",
        target.smogonSet?.moves ?? [],
        level,
      ));
    }
    if (mode !== "standard") {
      for (const category of ["Physical", "Special"] as const) {
        if (!categories.has(category)) continue;
        const hit = hits.find((h) => h.category === category);
        const ability = hit?.vs.counter?.ability ?? target.abilityCandidates[0];
        theirs.push(defenderPaste(
          target,
          { ability, item: target.counterItem, ...counterSpread(category) },
          category === "Physical" ? "Prep Counter Def" : "Prep Counter SpD",
          [],
          level,
        ));
      }
    }
  }

  return [...mine, ...theirs].join("\n\n");
}

/** Base64 of an ASCII paste, matching the calc's atob() */
function toBase64(text: string): string {
  return btoa(ascii(text));
}

export function showdownCalcUrl(paste: string, gen = 9): string {
  const params = new URLSearchParams();
  if (gen !== 9) params.set("gen", String(gen));
  params.set("import", toBase64(paste));
  return `${SHOWDOWN_CALC_URL}?${params.toString()}`;
}
