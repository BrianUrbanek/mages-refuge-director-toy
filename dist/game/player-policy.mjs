/** Pure player decisions, independent of combat resolution and the Director. */
export const BURST_STRATEGIES = Object.freeze({
  health: {
    name: "Relieve pressure",
    description: "Spend the last charge at 50% health.",
  },
  overwhelm: {
    name: "Prevent overwhelm",
    description: "Spend the last charge with 20+ living fuel-equivalent.",
  },
  priority: {
    name: "Priority targets",
    description:
      "Spend the last charge while a support or glass cannon is alive.",
  },
});
export function burstReason({
  charges,
  maxCharges,
  chargeProgress,
  hp,
  maxHp,
  strategy = "health",
  livingPoints = 0,
  priorityAlive = false,
}) {
  if (charges >= 2) return "two-charges";
  if (charges !== 1) return null;
  if (maxCharges > 1 && chargeProgress >= 8 - 1e-7) return "recharge-imminent";
  if (strategy === "health" && hp <= maxHp * 0.5) return "half-health";
  if (strategy === "overwhelm" && livingPoints >= 20) return "high-pressure";
  if (strategy === "priority" && priorityAlive) return "priority-present";
  return null;
}
export function steadyReservesReady({ hp, maxHp, charges }) {
  return (
    (hp >= maxHp * 0.7 && charges >= 2) || (hp >= maxHp - 1e-7 && charges >= 1)
  );
}
