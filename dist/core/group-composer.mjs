import { fitsPackLimits } from "./composition-limits.mjs";
import { clone, compareIds } from "./contracts.mjs";
import { rankEnemy } from "./composition-budget.mjs";
const cost = (xs) => xs.reduce((n, e) => n + e.cost, 0),
  union = (xs) => new Set(xs.flatMap((e) => e.tags));
export function composeGroup(
  config,
  ordinal = 0,
  finalBudget = null,
  totalBudget = Infinity,
) {
  const catalog = config.enemies,
    target =
      finalBudget === null
        ? Math.min(totalBudget, config.targets[ordinal % config.targets.length])
        : Math.min(finalBudget, config.finalTarget ?? 32),
    rules = config.rules;
  const fits = (p) => fitsPackLimits(p, rules) && cost(p) <= target + 1e-7;
  const legal = (p) =>
    p.length > 0 &&
    fits(p) &&
    cost(p) <= rules.maxAverageCost * p.length &&
    (finalBudget !== null || config.required.every((t) => union(p).has(t)));
  function complete(core) {
    const p = [...core];
    for (let i = 0; i < rules.maxMembers; i++) {
      const missing = config.required.filter((t) => !union(p).has(t));
      if (!missing.length) break;
      const candidates = catalog
        .filter(
          (e) => e.tags.some((t) => missing.includes(t)) && fits([...p, e]),
        )
        .sort(
          (a, b) =>
            b.tags.filter((t) => missing.includes(t)).length -
              a.tags.filter((t) => missing.includes(t)).length ||
            a.cost - b.cost ||
            compareIds(a.id, b.id),
        );
      if (!candidates.length) return null;
      p.push(candidates[0]);
    }
    while (cost(p) > rules.maxAverageCost * p.length) {
      const e = catalog
        .filter((e) => e.cost < cost(p) / p.length && fits([...p, e]))
        .sort((a, b) => a.cost - b.cost || compareIds(a.id, b.id))[0];
      if (!e) return null;
      p.push(e);
    }
    return legal(p) ? p : null;
  }
  let cores = config.cores
    .map((ids, id) => ({
      id,
      pack: ids.map((i) => catalog.find((e) => e.id === i)),
    }))
    .filter(
      (c) =>
        c.pack.every(Boolean) &&
        fits(c.pack) &&
        (finalBudget !== null ? legal(c.pack) : complete(c.pack)),
    );
  const trace = [
    `Target ${target.toFixed(1)} · ${cores.length} eligible cores`,
  ];
  for (const tag of config.preferred) {
    cores.sort(
      (a, b) =>
        b.pack.filter((e) => e.tags.includes(tag)).length -
        a.pack.filter((e) => e.tags.includes(tag)).length,
    );
    if (cores.length > 2) cores = cores.slice(0, Math.ceil(cores.length / 2));
    trace.push(`${tag}: ${cores.length} retained`);
  }
  let pack = cores.length
    ? finalBudget !== null
      ? [...cores[0].pack]
      : complete(cores[0].pack)
    : [];
  if (!cores.length && finalBudget === null)
    return { error: "No eligible authored composition" };
  while (pack.length < rules.maxMembers) {
    const candidates = catalog.filter((e) => legal([...pack, e]));
    if (!candidates.length) break;
    candidates.sort((a, b) => rankEnemy(config, a, b));
    pack.push(candidates[0]);
  }
  if (!pack.length)
    return finalBudget !== null ? null : { error: "Empty composition" };
  return {
    configId: config.id,
    menu: config.menu,
    target,
    cost: cost(pack),
    members: clone(pack),
    core: cores[0]?.id ?? -1,
    trace,
    finalSpend: finalBudget !== null,
    portalPreferences: clone(
      config.corePortalPreferences?.[cores[0]?.id] ??
        config.portalPreferences ??
        [],
    ),
  };
}
