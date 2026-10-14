/** Shared hard composition limits, independent of target size and encounter intent. */
export function packCost(pack) {
  return pack.reduce((n, e) => n + e.cost, 0);
}
export function fitsPackLimits(pack, rules, { average = false } = {}) {
  return (
    pack.length <= rules.maxMembers &&
    pack.filter((e) => e.tier === "champion").length <= rules.maxChampions &&
    (!average || packCost(pack) <= rules.maxAverageCost * pack.length + 1e-7) &&
    (rules.incompatiblePairs ?? []).every(([a, b]) =>
      a === b
        ? pack.filter((e) => e.id === a).length <= 1
        : !(pack.some((e) => e.id === a) && pack.some((e) => e.id === b)),
    )
  );
}
