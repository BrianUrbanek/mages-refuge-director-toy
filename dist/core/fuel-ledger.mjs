import { clone, validateAmount } from "./contracts.mjs";
/** Source IDs are opaque provenance. This ledger has no spatial concepts. */
export class FuelLedger {
  constructor() {
    this.potential = 0;
    this.available = 0;
    this.introduced = 0;
    this.spent = 0;
    this.slices = [];
  }
  add(amount, source) {
    validateAmount(amount);
    this.potential += amount;
    this.introduced += amount;
    this.slices.push({ source, remaining: amount });
    this.verify();
  }
  transfer(amount, source = null) {
    if (amount !== Infinity) validateAmount(amount);
    let actual = 0;
    for (const slice of this.slices) {
      if (source && slice.source !== source) continue;
      const n = Math.min(slice.remaining, amount - actual);
      slice.remaining -= n;
      actual += n;
      if (actual >= amount) break;
    }
    this.potential = Math.max(0, this.potential - actual);
    this.available += actual;
    this.verify();
    return actual;
  }
  spend(amount) {
    validateAmount(amount);
    if (this.available + 1e-7 < amount)
      throw new Error("Insufficient available fuel");
    this.available = Math.max(0, this.available - amount);
    this.spent += amount;
    this.verify();
  }
  verify() {
    const discrepancy = Math.abs(
      this.introduced - this.potential - this.available - this.spent,
    );
    if (discrepancy > 1e-5 || this.potential < 0 || this.available < 0)
      throw new Error("Fuel conservation violated");
    return discrepancy;
  }
  snapshot() {
    return clone({
      potential: this.potential,
      available: this.available,
      introduced: this.introduced,
      spent: this.spent,
      sources: this.slices,
    });
  }
}
