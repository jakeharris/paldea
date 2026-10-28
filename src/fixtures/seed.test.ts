import { describe, expect, it } from "vitest";
import { buildSeedLeagues } from "./seed";

describe("buildSeedLeagues", () => {
  it("expands every fixture species from the dex", () => {
    const [season4, season5] = buildSeedLeagues();
    expect(season4).toMatchObject({ name: "WCPL Season 4", archived: true });
    expect(season5.teams).toHaveLength(6);
    const chiYu = season5.teams.flatMap((t) => t.pokemon).find((p) => p.name === "Chi-Yu");
    expect(chiYu?.types).toEqual(["Dark", "Fire"]);
  });

  it("marks tera captains", () => {
    const mine = buildSeedLeagues()[1].teams.find((t) => t.isMyTeam)!;
    expect(mine.pokemon.filter((p) => p.isTeraCaptain).map((p) => p.name)).toEqual(["Keldeo", "Charjabug", "Cresselia"]);
  });
});
