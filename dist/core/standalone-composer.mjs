import { clone } from "./contracts.mjs";
import { packCost, fitsPackLimits } from "./composition-limits.mjs";
/** Complete authored groups bypass normal targets and required-role padding. */
export function composeStandalone(config, definition) {
  if (!definition.standalone) return null;
  const pack = definition.members.map((id) =>
    config.enemies.find((e) => e.id === id),
  );
  if (
    !pack.length ||
    !pack.every(Boolean) ||
    !fitsPackLimits(pack, config.rules, { average: true })
  )
    return null;
  const cost = packCost(pack);
  return {
    configId: config.id,
    menu: config.menu,
    target: cost,
    cost,
    members: clone(pack),
    core: -1,
    standalone: true,
    groupId: definition.id,
    groupTags: clone(definition.tags),
    trace: [`Standalone ${definition.id}: authored membership, no padding`],
    finalSpend: false,
    portalPreferences: clone(
      definition.portalPreferences ?? config.portalPreferences ?? [],
    ),
  };
}
