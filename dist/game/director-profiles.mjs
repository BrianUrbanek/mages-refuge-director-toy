/** Illustrative authored personality lists. Repeated instructions are distinct cards. */
const lists = {
  balanced: [1, 1, "breach", 0.85, 1.15, 1, 1, "breach", 1, 1],
  heavy: [0.85, 1, 1.15, 1.2, "breach", 1.1, 1.2, 1, 1.15, 1],
  swarm: [0.8, "breach", 0.9, 1, "breach", 0.8, 0.9, "reshuffle", 1, 1.1],
  crescendo: [0.7, 0.85, 1, "breach", 1.1, 1.2, 1.3, 1.4, 1.2, 1.1],
  wave: [0.7, 0.9, 1.1, 1.35, 1.1, 0.9, 0.7, "breach", 0.9, 1.1],
};
export function personalitySelection(id, mode = "random", scale = 1) {
  return {
    id,
    mode,
    minTarget: 10 * scale,
    maxTarget: 40 * scale,
    cards: lists[id].map((value, i) =>
      typeof value === "number"
        ? { id: `${id}-${i + 1}`, kind: "normal", targetMultiplier: value }
        : value === "breach"
          ? {
              id: `${id}-${i + 1}`,
              kind: "breach",
              groupTags: ["breach"],
              portalTags: ["side-sealed"],
              groupTagPolicy: "enforce",
              portalTagPolicy: "enforce",
            }
          : { id: `${id}-${i + 1}`, kind: "reshuffle" },
    ),
  };
}
export function breachGroups(menu, enemies, scale = 1) {
  const fodder = enemies.find((e) => e.tags.includes("fodder"));
  const bruiser = enemies.find((e) => Math.abs(e.cost - 5 * scale) < 1e-7);
  const regular = enemies.find((e) => Math.abs(e.cost - 1.2 * scale) < 1e-7);
  if (!fodder || (!bruiser && !regular)) return [];
  const members = bruiser
    ? [bruiser.id, ...Array(8).fill(fodder.id)]
    : [...Array(7).fill(regular.id), fodder.id];
  return [
    {
      id: menu + "-breach",
      tags: ["breach"],
      standalone: true,
      members,
      portalPreferences: ["side-sealed"],
    },
  ];
}
