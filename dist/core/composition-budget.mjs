import { clone, compareIds } from "./contracts.mjs";
import { packCost, fitsPackLimits } from "./composition-limits.mjs";
/** Shared content ranking for initial composition and final-tail expansion. */
export function rankEnemy(config, a, b) {
  for (const tag of config.preferred) {
    const d = Number(b.tags.includes(tag)) - Number(a.tags.includes(tag));
    if (d) return d;
  }
  for (const [tag, direction] of config.local ?? []) {
    const d =
      direction * (Number(b.tags.includes(tag)) - Number(a.tags.includes(tag)));
    if (d) return d;
  }
  return b.cost - a.cost || compareIds(a.id, b.id);
}
/** Preserve the selected recipe/core; only expandable groups can absorb a tail. */
export function foldFinalTail(config, group, total, cheapestOption) {
  const remainder = Math.max(0, total - group.cost);
  if (
    group.standalone ||
    remainder <= 1e-7 ||
    remainder + 1e-7 >= cheapestOption
  )
    return group;
  const pack = clone(group.members);
  while (pack.length < config.rules.maxMembers) {
    const candidates = config.enemies
      .filter((e) => {
        const p = [...pack, e];
        return (
          packCost(p) <= total + 1e-7 &&
          fitsPackLimits(p, config.rules, { average: true })
        );
      })
      .sort((a, b) => rankEnemy(config, a, b));
    if (!candidates.length) break;
    pack.push(candidates[0]);
  }
  const folded = Math.max(0, packCost(pack) - group.cost);
  return {
    ...group,
    target: total,
    cost: packCost(pack),
    members: pack,
    foldedFuel: folded,
    trace: [
      ...group.trace,
      `Final tail: folded ${folded.toFixed(2)}; residue ${(total - packCost(pack)).toFixed(2)}`,
    ],
  };
}
