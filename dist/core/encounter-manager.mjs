/** Standalone director orchestration. Host time, readiness and spawn transactions are injected. */
import {
  clone,
  validateAmount,
  validateConfig,
  WAIT_LABELS,
  deepFreeze,
  validatePortals,
} from "./contracts.mjs";
import { composeGroup } from "./group-composer.mjs";
import { FuelLedger } from "./fuel-ledger.mjs";
import { selectPortal, matchesPortalOpportunity } from "./portal-selection.mjs";
import { EncounterList, validateSelection } from "./encounter-list.mjs";
import { compileEncounterOpportunities } from "./encounter-opportunities.mjs";
import { foldFinalTail } from "./composition-budget.mjs";
export { composeGroup } from "./group-composer.mjs";
export class EncounterManager {
  #config;
  #fuel;
  #selector;
  get config() {
    return clone(this.#config);
  }
  constructor({ config, runtime = {}, selectionSeed = 1 }) {
    validateConfig(config);
    validateSelection(config);
    this.runtime = Object.freeze({
      engineRecoverySeconds: 1,
      warningLeadSeconds: 1.1,
      budgetAwareComposition: false,
      ...clone(runtime),
    });
    validateAmount(this.runtime.engineRecoverySeconds);
    validateAmount(this.runtime.warningLeadSeconds);
    if (typeof this.runtime.budgetAwareComposition !== "boolean")
      throw new Error("Invalid budget-aware composition setting");
    this.#config = clone(config);
    this.#fuel = new FuelLedger();
    this.#selector = new EncounterList(selectionSeed);
    Object.assign(this, {
      time: 0,
      ordinal: 0,
      next: null,
      dispatch: null,
      pending: false,
      lastSpawn: -Infinity,
      ended: false,
      finalSpend: false,
      finalComplete: false,
      budgetComplete: false,
      error: null,
      waitReason: "ready",
      planSerial: 0,
      events: [],
      eventSerial: 0,
      applied: new Set(),
      living: new Set(),
      portals: [],
    });
    this.prepare();
  }
  emit(type, data = {}) {
    this.events.push({
      id: ++this.eventSerial,
      time: this.time,
      type,
      ...clone(data),
    });
  }
  drainEvents() {
    return this.events.splice(0);
  }
  get wait() {
    return WAIT_LABELS[this.waitReason];
  }
  get potential() {
    return this.#fuel.potential;
  }
  get available() {
    return this.#fuel.available;
  }
  get introduced() {
    return this.#fuel.introduced;
  }
  get spent() {
    return this.#fuel.spent;
  }
  get slices() {
    return this.#fuel.snapshot().sources;
  }
  addPotential(amount, source) {
    this.#fuel.add(amount, source);
    if (amount > 0) this.budgetComplete = false;
    this.emit("fuel-added", { amount, source });
  }
  transfer(amount, source = null, reason = "explicit") {
    const actual = this.#fuel.transfer(amount, source);
    if (actual)
      this.emit("fuel-transferred", {
        amount: actual,
        source,
        reason,
        potential: this.potential,
        available: this.available,
      });
    return actual;
  }
  updateConfig(config) {
    validateConfig(config);
    validateSelection(config);
    this.#config = clone(config);
    this.error = null;
    this.emit("menu-changed", {
      configId: config.id,
      preservedPlan: this.next?.id,
    });
    this.prepare();
  }
  updatePortals(portals) {
    validatePortals(portals);
    const changed = JSON.stringify(this.portals) !== JSON.stringify(portals);
    this.portals = clone(portals);
    if (changed && this.#config.selection) this.error = null;
    if (
      this.next?.portalId &&
      !this.portals.some((p) => matchesPortalOpportunity(this.next, p))
    ) {
      this.emit("selection-canceled", {
        groupId: this.next.id,
        portalId: this.next.portalId,
        reason: "Required opportunity disappeared",
      });
      this.cancelDispatch("Required opportunity disappeared");
      this.next = null;
    }
  }
  selectPortal(group, adapter) {
    return selectPortal(group, this.portals, adapter);
  }

  applyOnce(id, { add = 0, transfer = 0, trigger = false } = {}) {
    validateAmount(add);
    validateAmount(transfer);
    if (this.ended || this.applied.has(id)) return false;
    this.applied.add(id);
    if (add) {
      this.finalSpend = false;
      this.finalComplete = false;
      this.addPotential(add, id);
    }
    if (transfer) this.transfer(transfer);
    if (trigger) this.requestSpawn();
    return true;
  }
  requestSpawn() {
    if (this.ended || this.finalComplete || this.budgetComplete) return;
    this.pending = true;
    this.emit("trigger-requested", { planId: this.next?.id });
  }
  invalidate() {
    if (this.ended) return;
    this.cancelDispatch("Explicit invalidation");
    this.next = null;
    this.error = null;
    this.prepare();
  }
  beginFinalSpend(reason) {
    if (this.ended || this.finalSpend) return false;
    this.transfer(Infinity, null, "final-spend");
    this.cancelDispatch("Final spend");
    this.next = null;
    this.pending = false;
    this.finalSpend = true;
    this.finalComplete = false;
    this.budgetComplete = false;
    this.error = null;
    this.emit("final-spend-start", { reason });
    this.prepare();
    return true;
  }
  prepare() {
    if (
      this.ended ||
      this.next ||
      this.finalComplete ||
      this.budgetComplete ||
      this.error
    )
      return;
    if (this.runtime.budgetAwareComposition && !this.introduced) return;
    if (this.#config.selection && !this.portals.length && !this.finalSpend)
      return;
    const total = this.available + this.potential,
      budget = this.runtime.budgetAwareComposition ? total : Infinity;
    let p,
      cheapest = Infinity;
    if (this.runtime.budgetAwareComposition && !this.finalSpend) {
      const options = this.#config.selection
        ? [
            ...compileEncounterOpportunities(
              this.#config.selection,
              this.#config,
              this.portals,
              this.ordinal,
            ).resolved.values(),
          ].filter((g) => !g.reshuffle)
        : [composeGroup(this.#config, this.ordinal)].filter(
            (g) => g && !g.error,
          );
      // Missing portal/content opportunities are configuration waits, not exhaustion.
      if (!options.length) {
        this.error = "No valid encounter opportunities";
        this.emit("composition-error", { message: this.error });
        return;
      }
      cheapest = Math.min(...options.map((g) => g.cost));
    }
    if (this.#config.selection && !this.finalSpend) {
      const result = this.#selector.select(
        this.#config,
        this.portals,
        this.ordinal,
        budget,
      );
      for (const event of result.events) {
        const { type, ...data } = event;
        this.emit(type, data);
      }
      p = result.group ?? { error: result.error };
    } else
      p = composeGroup(
        this.#config,
        this.ordinal,
        this.finalSpend ? this.available : null,
        budget,
      );
    if (this.runtime.budgetAwareComposition && !this.finalSpend) {
      if (p?.error) {
        // Terminal residue may relax authored roles; it still obeys hard pack limits.
        p = composeGroup(this.#config, this.ordinal, total);
        if (p) p.terminalComposition = true;
      }
      if (!p) {
        this.budgetComplete = true;
        this.pending = false;
        this.emit("fuel-drained", {
          unused: total,
          potential: this.potential,
          available: this.available,
        });
        return;
      }
      p = foldFinalTail(this.#config, p, total, cheapest);
      if (p.foldedFuel > 0)
        p.foldedTransferred = this.transfer(
          p.foldedFuel / 2,
          null,
          "final-tail",
        );
    }
    if (p === null) {
      this.finalComplete = true;
      this.pending = false;
      this.emit("final-spend-complete", { unused: this.available });
      return;
    }
    if (p.error) {
      this.error = p.error;
      this.emit("composition-error", { message: p.error });
      return;
    }
    this.next = deepFreeze({ ...p, id: ++this.planSerial });
    if (this.finalSpend) this.pending = true;
    this.emit("group-prepared", { group: this.next });
  }
  cancelDispatch(reason) {
    if (this.dispatch)
      this.emit("dispatch-canceled", { attempt: clone(this.dispatch), reason });
    this.dispatch = null;
  }
  isEventApplied(id) {
    return this.applied.has(id);
  }
  sourcePotential(source) {
    return this.slices
      .filter((s) => s.source === source)
      .reduce((n, s) => n + s.remaining, 0);
  }
  notifyDefeat(id) {
    this.living.delete(id);
  }
  fundingEta() {
    if (!this.next) return null;
    const deficit = Math.max(0, this.next.cost - this.available);
    if (deficit <= 1e-7) return 0;
    if (this.#config.flowRate <= 0 || this.potential + 1e-7 < deficit)
      return null;
    return deficit / this.#config.flowRate;
  }
  recoveryRemaining() {
    return Math.max(
      0,
      this.lastSpawn + this.runtime.engineRecoverySeconds - this.time,
    );
  }
  tick(dt, adapter) {
    validateAmount(dt);
    if (this.ended) return;
    this.time += dt;
    this.transfer(this.#config.flowRate * dt, null, "passive");
    this.prepare();
    this.waitReason = "ready";
    if (!this.next) {
      this.waitReason = this.error ? "composition-error" : "ready";
      this.verify();
      return;
    }
    if (
      this.dispatch &&
      (!this.portals.some(
        (p) => p.id === this.dispatch.entrance && p.eligible,
      ) ||
        !adapter.canEnter(this.next, this.dispatch.entrance))
    )
      this.cancelDispatch("Entrance unavailable");
    const eta = this.fundingEta();
    if (eta !== 0) {
      // Telegraph predicts passive affordability. It never reserves or spends fuel.
      if (
        this.next.telegraph !== false &&
        eta !== null &&
        eta <= this.runtime.warningLeadSeconds + 1e-7 &&
        adapter.assetsReady(this.next)
      ) {
        const entrance =
          this.dispatch?.entrance ?? this.selectPortal(this.next, adapter);
        if (entrance) {
          if (!this.dispatch) {
            this.dispatch = {
              planId: this.next.id,
              entrance,
              origin: "Passive forecast",
              until: this.time + eta,
            };
            this.emit("warning-started", { attempt: this.dispatch });
          } else this.dispatch.until = this.time + eta;
        }
      } else this.cancelDispatch("Passive funding forecast changed");
      this.waitReason = this.dispatch
        ? "forecast"
        : eta === null
          ? "unfundable"
          : "funding";
      this.verify();
      return;
    }
    // Affordability, readiness and spatial safety govern commitment. Warning
    // duration is presentation only; funding events can complete it immediately.
    if (!adapter.assetsReady(this.next)) this.waitReason = "assets";
    else if (this.recoveryRemaining() > 1e-7)
      this.waitReason = "engine-recovery";
    else {
      const entrance =
        this.dispatch?.entrance ?? this.selectPortal(this.next, adapter);
      if (!entrance) this.waitReason = "portal-capacity";
      else {
        const p = this.next,
          origin = this.pending ? "Triggered" : "Funded",
          result = adapter.commitSpawn(clone(p), entrance);
        if (!result?.success) {
          this.cancelDispatch("spawn-failure");
          this.waitReason = "spawn-failure";
        } else {
          if (
            !Array.isArray(result.actorIds) ||
            result.actorIds.length !== p.members.length ||
            new Set(result.actorIds).size !== result.actorIds.length ||
            result.actorIds.some(
              (id) =>
                this.living.has(id) ||
                !(
                  (typeof id === "string" && id.length > 0) ||
                  (typeof id === "number" && Number.isSafeInteger(id))
                ),
            )
          )
            throw new Error(
              "Spawn adapter must commit one unique actor ID per member",
            );
          if (result.portals) validatePortals(result.portals);
          this.#fuel.spend(p.cost);
          result.actorIds.forEach((id) => this.living.add(id));
          this.lastSpawn = this.time;
          this.ordinal++;
          this.emit("spawn-committed", {
            group: p,
            entrance,
            origin,
            actorIds: result.actorIds,
          });
          this.dispatch = null;
          this.next = null;
          this.pending = false;
          if (result.portals) this.updatePortals(result.portals);
          this.prepare();
          this.waitReason = this.next
            ? this.available + 1e-7 >= this.next.cost
              ? "engine-recovery"
              : "funding"
            : "ready";
        }
      }
    }
    this.verify();
  }
  verify() {
    return this.#fuel.verify();
  }
  snapshot() {
    return clone({
      time: this.time,
      potential: this.potential,
      available: this.available,
      introduced: this.introduced,
      spent: this.spent,
      next: this.next,
      dispatch: this.dispatch,
      pending: this.pending,
      lastSpawn: this.lastSpawn,
      fundingEta: this.fundingEta(),
      recoveryRemaining: this.recoveryRemaining(),
      portals: this.portals,
      finalSpend: this.finalSpend,
      finalComplete: this.finalComplete,
      budgetComplete: this.budgetComplete,
      ended: this.ended,
      wait: this.wait,
      waitReason: this.waitReason,
      error: this.error,
      livingOpposition: this.living.size,
      fuelSources: this.slices,
      runtime: this.runtime,
      selection: this.#config.selection ? this.#selector.snapshot() : null,
    });
  }
  end() {
    if (this.ended) return;
    this.emit("activity-ended", {
      fuel: {
        potential: this.potential,
        available: this.available,
        spent: this.spent,
      },
      living: this.living.size,
    });
    this.cancelDispatch("Activity ended");
    this.ended = true;
    this.waitReason = "stopped";
    this.next = null;
    this.pending = false;
  }
}
