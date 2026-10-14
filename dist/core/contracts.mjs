/** Plain data validation; no host or engine dependency. */
export const clone = (x) => structuredClone(x);
export const compareIds = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
export function deepFreeze(value, seen = new WeakSet()) {
  if (value && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const child of Object.values(value)) deepFreeze(child, seen);
    Object.freeze(value);
  }
  return value;
}
export const validateAmount = (n) => {
  if (!Number.isFinite(n) || n < 0)
    throw new Error("Fuel must be finite and nonnegative");
};
export function validatePortals(portals) {
  if (!Array.isArray(portals)) throw new Error("Invalid portal descriptors");
  const ids = new Set();
  for (const p of portals) {
    if (
      typeof p.id !== "string" ||
      !p.id ||
      ids.has(p.id) ||
      !Array.isArray(p.tags) ||
      p.tags.some((t) => typeof t !== "string") ||
      typeof p.eligible !== "boolean" ||
      (p.breachable !== undefined && typeof p.breachable !== "boolean")
    )
      throw new Error("Invalid portal descriptor");
    ids.add(p.id);
  }
}
export function validateConfig(c) {
  if (!c || !c.enemies?.length || !c.targets?.length)
    throw new Error("Missing encounter content");
  const ids = new Set();
  for (const e of c.enemies) {
    if (
      typeof e.id !== "string" ||
      !e.id ||
      !Number.isFinite(e.cost) ||
      e.cost <= 0 ||
      ids.has(e.id) ||
      !Array.isArray(e.tags) ||
      !Number.isFinite(e.footprint) ||
      e.footprint < 0
    )
      throw new Error("Invalid resolved enemy");
    ids.add(e.id);
  }
  for (const n of [...c.targets, c.flowRate]) validateAmount(n);
  if (
    !Array.isArray(c.cores) ||
    !Array.isArray(c.required) ||
    !Array.isArray(c.preferred)
  )
    throw new Error("Invalid composition metadata");
  if (
    !c.rules ||
    !Number.isInteger(c.rules.maxMembers) ||
    c.rules.maxMembers < 1 ||
    !Number.isInteger(c.rules.maxChampions) ||
    c.rules.maxChampions < 0 ||
    !Number.isFinite(c.rules.maxAverageCost) ||
    c.rules.maxAverageCost <= 0
  )
    throw new Error("Invalid pack limits");
  if (
    c.rules.incompatiblePairs &&
    (!Array.isArray(c.rules.incompatiblePairs) ||
      c.rules.incompatiblePairs.some(
        (pair) =>
          !Array.isArray(pair) ||
          pair.length !== 2 ||
          pair.some((id) => !ids.has(id)),
      ))
  )
    throw new Error("Invalid compatibility pairs");
}

/** Diagnostic labels preserve the old API; integrations should use reason codes. */
export const WAIT_LABELS = Object.freeze({
  ready: "",
  funding: "Waiting for fuel",
  unfundable: "Insufficient remaining fuel",
  forecast: "Anticipating passive funding",
  assets: "Preparing assets",
  "engine-recovery": "Engine recovery",
  "portal-capacity": "Safe entrance / capacity",
  "spawn-failure": "Spawn adapter failed",
  stopped: "Director stopped",
  "composition-error": "Composition error",
});
