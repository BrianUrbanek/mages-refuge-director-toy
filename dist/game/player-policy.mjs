/** Pure player decisions, independent of combat resolution and the Director. */
export function burstReason({
  charges,
  maxCharges,
  chargeProgress,
  hp,
  maxHp,
}) {
  if (charges >= 2) return "two-charges";
  if (charges !== 1) return null;
  if (maxCharges > 1 && chargeProgress >= 8 - 1e-7) return "recharge-imminent";
  if (hp <= maxHp * 0.5) return "half-health";
  return null;
}
export function steadyReservesReady({ hp, maxHp, charges }) {
  return (
    (hp >= maxHp * 0.7 && charges >= 2) || (hp >= maxHp - 1e-7 && charges >= 1)
  );
}
