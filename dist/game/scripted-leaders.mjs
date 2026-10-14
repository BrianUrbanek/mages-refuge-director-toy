/** Demo combat tuning only; scripted actors introduce/spend no Director fuel. */
export function scriptedLeaderStats(key) {
  const guardian = key.startsWith("guardian-"),
    points = guardian ? 4 : 20;
  return {
    cost: points,
    fuelEquivalent: points,
    directorFuelCost: 0,
    hp: points * 22 * (guardian ? 1 : 1.25),
    maxHp: points * 22 * (guardian ? 1 : 1.25),
    damageMultiplier: guardian ? 1 : 0.8,
  };
}
