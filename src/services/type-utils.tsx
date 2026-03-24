export const TYPE_COLORS: Record<string, string> = {
  Normal: "#A8A77A",
  Fire: "#EE8130",
  Water: "#6390F0",
  Electric: "#F7D02C",
  Grass: "#7AC74C",
  Ice: "#96D9D6",
  Fighting: "#C22E28",
  Poison: "#A33EA1",
  Ground: "#E2BF65",
  Flying: "#A98FF3",
  Psychic: "#F95587",
  Bug: "#A6B91A",
  Rock: "#B6A136",
  Ghost: "#735797",
  Dragon: "#6F35FC",
  Dark: "#705746",
  Steel: "#B7B7CE",
  Fairy: "#D685AD",
};

export function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase leading-none"
      style={{ backgroundColor: TYPE_COLORS[type] ?? "#888", color: "#fff" }}
    >
      {type}
    </span>
  );
}
