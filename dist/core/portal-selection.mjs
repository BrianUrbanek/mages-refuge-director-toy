import { compareIds } from "./contracts.mjs";
export function matchesPortalOpportunity(group, portal) {
  return (
    portal.eligible &&
    (group.portalId
      ? portal.id === group.portalId &&
        (group.intent !== "breach" || portal.breachable)
      : !portal.breachable) &&
    (group.requiredPortalTags ?? []).every((tag) => portal.tags.includes(tag))
  );
}
/** Host provides eligibility and safety; the director ranks opaque tagged IDs. */
export function selectPortal(group, portals, adapter) {
  const preferences = group.portalPreferences ?? [];
  const candidates = portals.filter(
    (p) => matchesPortalOpportunity(group, p) && adapter.canEnter(group, p.id),
  );
  candidates.sort((a, b) => {
    for (const tag of preferences) {
      const delta = Number(b.tags.includes(tag)) - Number(a.tags.includes(tag));
      if (delta) return delta;
    }
    return compareIds(a.id, b.id);
  });
  return candidates[0]?.id ?? null;
}
