import { composeGroup } from "./group-composer.mjs";
import { composeStandalone } from "./standalone-composer.mjs";
import { compareIds } from "./contracts.mjs";
/** Tags remain scoped to their role: group tags cannot satisfy portal requirements. */
const matches = (value, tags) => tags.every((t) => value.tags.includes(t));
function candidates(values, tags = [], policy = "enforce") {
  const result = values.filter((v) => policy !== "enforce" || matches(v, tags));
  return result.sort(
    (a, b) =>
      (policy === "prefer"
        ? Number(matches(b, tags)) - Number(matches(a, tags))
        : 0) || compareIds(a.id, b.id),
  );
}
export function resolveEncounterCard(
  card,
  config,
  portals,
  ordinal = 0,
  totalBudget = Infinity,
) {
  if (card.kind === "reshuffle") return { reshuffle: true };
  if (card.kind === "normal") {
    if (!portals.some((p) => p.eligible && !p.breachable)) return null;
    const base = config.targets[ordinal % config.targets.length];
    const target = Math.min(
      config.selection.maxTarget ?? Infinity,
      Math.max(
        config.selection.minTarget ?? 0,
        card.target ?? base * (card.targetMultiplier ?? 1),
      ),
    );
    const group = composeGroup(
      {
        ...config,
        targets: [target],
        preferred: [...(card.preferredTags ?? []), ...config.preferred],
      },
      ordinal,
      null,
      totalBudget,
    );
    return group?.error ? null : group;
  }
  const groups = candidates(
    (config.groups ?? []).filter((g) => g.standalone),
    card.groupTags ?? [],
    card.groupTagPolicy,
  );
  const available = portals.filter(
    (p) =>
      p.eligible &&
      (card.kind === "breach" ? p.breachable === true : !p.breachable),
  );
  const routes = candidates(
    available,
    card.portalTags ?? [],
    card.portalTagPolicy,
  );
  for (const definition of groups) {
    const group = composeStandalone(config, definition);
    if (!group || group.cost > totalBudget + 1e-7) continue;
    // Ordered preferences then ordinal ID; do not treat temporary host occupancy as invalidity.
    routes.sort((a, b) => {
      if (card.portalTagPolicy === "prefer") {
        const d =
          Number(matches(b, card.portalTags ?? [])) -
          Number(matches(a, card.portalTags ?? []));
        if (d) return d;
      }
      for (const tag of group.portalPreferences) {
        const d = Number(b.tags.includes(tag)) - Number(a.tags.includes(tag));
        if (d) return d;
      }
      return compareIds(a.id, b.id);
    });
    if (!routes.length) return null;
    return {
      ...group,
      portalId: routes[0].id,
      requiredPortalTags:
        (card.portalTagPolicy ?? "enforce") === "enforce"
          ? [...(card.portalTags ?? [])]
          : [],
      intent: card.kind,
      telegraph: card.kind !== "breach",
    };
  }
  return null;
}
export function compileEncounterOpportunities(
  selection,
  config,
  portals,
  ordinal = 0,
  totalBudget = Infinity,
) {
  const resolved = new Map(),
    excluded = [];
  for (const card of selection.cards) {
    const group = resolveEncounterCard(
      card,
      config,
      portals,
      ordinal,
      totalBudget,
    );
    if (group) resolved.set(card.id, group);
    else excluded.push(card.id);
  }
  return { resolved, excluded };
}
