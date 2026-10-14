/** Host-only player tuning. The Director never imports this module. */
export const PLAYER_STAT_OPTIONS = Object.freeze(
  [
    {
      key: "maxCharges",
      label: "DPS charge capacity",
      steps: [1, 2, 3, 4],
      baseline: 2,
      unit: "",
    },
    {
      key: "maxHp",
      label: "Maximum health",
      steps: [75, 100, 125, 150, 200],
      baseline: 100,
      unit: " HP",
    },
    {
      key: "maxPotions",
      label: "Potion capacity",
      steps: [1, 2, 3],
      baseline: 1,
      unit: "",
    },
    {
      key: "power",
      label: "Base damage",
      steps: [24, 36, 48, 60, 72],
      baseline: 36,
      unit: " / sec",
    },
    {
      key: "regen",
      label: "Base regeneration",
      steps: [0.5, 1, 1.5, 2, 3],
      baseline: 1,
      unit: " HP / sec",
    },
  ].map((o) => Object.freeze({ ...o, steps: Object.freeze(o.steps) })),
);
export const DEFAULT_PLAYER_STATS = Object.freeze(
  Object.fromEntries(PLAYER_STAT_OPTIONS.map((o) => [o.key, o.baseline])),
);
export function resolvePlayerStats(input = {}) {
  const result = { ...DEFAULT_PLAYER_STATS, ...input };
  for (const key of Object.keys(DEFAULT_PLAYER_STATS)) {
    if (!Number.isFinite(result[key]) || result[key] <= 0)
      throw new Error("Invalid player stat: " + key);
    if (key === "maxCharges" || key === "maxPotions") {
      if (!Number.isSafeInteger(result[key]) || result[key] > 10)
        throw new Error("Invalid capacity: " + key);
    }
  }
  return Object.freeze(
    Object.fromEntries(
      Object.keys(DEFAULT_PLAYER_STATS).map((k) => [k, result[k]]),
    ),
  );
}
