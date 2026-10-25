import { describe, it, expect } from "vitest";
import { getDexSpecies, toDraftPokemon } from "./pokemon-data";
import { attackerSetPaste, showdownCalcUrl } from "./showdown-export";
import type { AttackerSet } from "./offense-finder";

function set(overrides: Partial<AttackerSet> = {}): AttackerSet {
  return {
    id: "x",
    rosterIndex: 0,
    pokemon: { ...toDraftPokemon(getDexSpecies("Garchomp")!), isTeraCaptain: true },
    nature: "Jolly",
    item: "Choice Band",
    ability: "Rough Skin",
    teraType: "Ground",
    moves: ["Earthquake", "Stone Edge"],
    kos: [],
    mask: 0,
    speedStat: 333,
    ...overrides,
  };
}

describe("showdown export", () => {
  it("writes a Showdown paste with a non-species nickname header", () => {
    const paste = attackerSetPaste(set(), "Prep 1 Jolly");
    expect(paste.split("\n")).toEqual([
      "Prep 1 Jolly (Garchomp) @ Choice Band",
      "Ability: Rough Skin",
      "Tera Type: Ground",
      "EVs: 4 HP / 252 Atk / 252 Spe",
      "Jolly Nature",
      "- Earthquake",
      "- Stone Edge",
    ]);
  });

  it("omits the item when none is needed", () => {
    expect(attackerSetPaste(set({ item: "", teraType: null }), "Prep").split("\n")[0]).toBe("Prep (Garchomp)");
  });

  it("encodes the paste the way the calc's atob() import expects", () => {
    const paste = "Prep (Flabébé)\nAbility: Flower Veil";
    const url = new URL(showdownCalcUrl(paste));
    expect(url.origin).toBe("https://calc.pokemonshowdown.com");
    expect(url.searchParams.has("gen")).toBe(false);
    expect(atob(url.searchParams.get("import")!)).toBe("Prep (Flabebe)\nAbility: Flower Veil");
    expect(new URL(showdownCalcUrl(paste, 8)).searchParams.get("gen")).toBe("8");
  });
});
