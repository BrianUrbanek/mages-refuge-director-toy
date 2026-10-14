import { resolvePlayerStats } from "./player-stats.mjs";
import { burstReason, BURST_STRATEGIES } from "./player-policy.mjs";
/** Abstract combat host: actor health, movement, spill pulses and player reserves. */
export class CombatModel {
  constructor({
    power = 36,
    stats = {},
    priority = "nearest",
    burstStrategy = "health",
    onEvent = () => {},
    onDefeat = () => {},
  } = {}) {
    if (!BURST_STRATEGIES[burstStrategy])
      throw new Error("Invalid last-charge strategy");
    const resolved = resolvePlayerStats({
      ...stats,
      power: stats.power ?? power,
    });
    Object.assign(this, {
      ...resolved,
      power: resolved.power,
      priority,
      burstStrategy,
      onEvent,
      onDefeat,
      actors: [],
      hp: resolved.maxHp,
      kills: 0,
      charges: resolved.maxCharges,
      chargeProgress: 0,
      burstCount: 0,
      regen: resolved.regen,
      pressurePerPoint: 0.24,
      pulseInterval: 0.5,
      attackProgress: 0,
      emergencyBurstPending: false,
      minHp: resolved.maxHp,
      potions: resolved.maxPotions,
      potionProgress: 0,
      potionsUsed: 0,
      potionHealing: 0,
      potionKillRefills: 0,
      potionLeaderRefills: 0,
      selected: null,
      time: 0,
    });
  }
  effect(type, data = {}) {
    this.onEvent({ kind: type, ...data });
  }
  note(text, type = "event") {
    this.onEvent({ kind: "message", text, type });
  }
  step(time, dt) {
    this.time = time;
    this.moveActors(dt);
    this.refillCharges(dt);
    this.hp = Math.min(
      this.maxHp,
      Math.max(0, this.hp + (this.effectiveRegen() - this.incomingDps()) * dt),
    );
    this.minHp = Math.min(this.minHp, this.hp);
    const healthForDecision = this.hp;
    if (this.burstStrategy !== "health") this.emergencyBurstPending = false;
    if (
      this.burstStrategy === "health" &&
      this.actors.length &&
      this.charges > 0 &&
      healthForDecision <= this.maxHp * 0.5
    )
      this.emergencyBurstPending = true;
    this.usePotion();
    if (this.hp <= 0) return false;
    this.attackProgress += dt;
    while (this.attackProgress + 1e-9 >= this.pulseInterval) {
      this.attackProgress -= this.pulseInterval;
      this.pulse({ healthForDecision });
    }
    return true;
  }
  defeat(actor) {
    this.actors = this.actors.filter((a) => a !== actor);
    if (!this.actors.length) this.emergencyBurstPending = false;
    this.kills++;
    this.effect("death", { actorId: actor.id });
    if (actor.leader) this.refillPotion("scripted-leader", actor.id);
    else if (this.potions < this.maxPotions) {
      this.potionProgress += actor.cost;
      while (
        this.potionProgress + 1e-9 >= 30 &&
        this.potions < this.maxPotions
      ) {
        this.potionProgress = Math.max(0, this.potionProgress - 30);
        this.refillPotion("fuel-kills", actor.id);
      }
    }
    this.onDefeat(actor);
  }
  // Compatibility for existing single-potion fixtures; actual resource is a count.
  get potionReady() {
    return this.potions > 0;
  }
  set potionReady(value) {
    this.potions = value ? this.maxPotions : 0;
  }
  usePotion() {
    let used = false;
    while (this.potions > 0 && this.hp > 0 && this.hp < this.maxHp * 0.5) {
      const before = this.hp,
        wasFull = this.potions === this.maxPotions;
      this.hp = Math.min(this.maxHp, this.hp + 40);
      this.potions--;
      if (wasFull) this.potionProgress = 0;
      this.potionsUsed++;
      this.potionHealing += this.hp - before;
      this.effect("potion-used", {
        before,
        health: this.hp,
        healing: this.hp - before,
        potionsRemaining: this.potions,
      });
      used = true;
    }
    return used;
  }
  refillPotion(reason, actorId) {
    if (this.potions === this.maxPotions) return false;
    const before = this.potions;
    this.potions =
      reason === "scripted-leader" ? this.maxPotions : this.potions + 1;
    if (this.potions === this.maxPotions) this.potionProgress = 0;
    if (reason === "scripted-leader") this.potionLeaderRefills++;
    else this.potionKillRefills++;
    this.effect("potion-refilled", {
      reason,
      actorId,
      restored: this.potions - before,
      potions: this.potions,
    });
    this.usePotion();
    return true;
  }
  potionState() {
    return {
      ready: this.potionReady,
      count: this.potions,
      capacity: this.maxPotions,
      progress: this.potionProgress,
      required: 30,
    };
  }
  livingCost() {
    return this.actors.reduce((n, a) => n + a.cost, 0);
  }
  incomingDps() {
    return this.livingCost() * this.pressurePerPoint;
  }
  effectiveRegen() {
    // Quiet recovery affects health only; burst thresholds use base regeneration.
    return this.regen * (this.actors.length === 0 ? 5 : 1);
  }
  moveActors(dt) {
    for (const a of this.actors) {
      a.age += dt;
      const seed = a.id * 2.39996,
        role = a.leader
          ? "boss"
          : a.tags.includes("support")
            ? "support"
            : a.tags.includes("ranged")
              ? "ranged"
              : "melee",
        radius =
          role === "boss"
            ? 0.14
            : role === "support"
              ? 0.34
              : role === "ranged"
                ? 0.28
                : 0.08 + (a.id % 11) * 0.013;
      const tx = 0.5 + Math.cos(seed) * radius,
        ty = 0.57 + Math.sin(seed) * radius * 0.65,
        f = Math.min(1, dt * (a.age < 2 ? 1.5 : 2.5));
      a.position.x += (tx - a.position.x) * f;
      a.position.y += (ty - a.position.y) * f;
    }
  }
  onArrival() {
    if (!this.actors.length || this.charges < 2) return false;
    this.attackProgress = 0;
    this.pulse();
    return true;
  }
  pulse({ healthForDecision = this.hp } = {}) {
    if (!this.actors.length) return;
    const reason = burstReason({
        charges: this.charges,
        maxCharges: this.maxCharges,
        chargeProgress: this.chargeProgress,
        maxHp: this.maxHp,
        strategy: this.burstStrategy,
        livingPoints: this.livingCost(),
        priorityAlive: this.actors.some(
          (a) => a.tags.includes("support") || a.tags.includes("glass-cannon"),
        ),
        hp: this.emergencyBurstPending
          ? Math.min(healthForDecision, this.maxHp * 0.5)
          : healthForDecision,
      }),
      boosted = reason !== null;
    if (boosted) {
      this.emergencyBurstPending = false;
      this.charges--;
      this.burstCount++;
      this.effect("burst", {
        reason,
        multiplier: 4,
        damage: this.power * this.pulseInterval * 4,
        chargesRemaining: this.charges,
      });
      this.note(
        `Burst pulse ×4 · ${this.charges}/${this.maxCharges} charges remain.`,
        "combat",
      );
    }
    let remaining = this.power * this.pulseInterval * (boosted ? 4 : 1),
      actor = this.target(),
      from = { x: 0.5, y: 0.57 };
    while (actor && remaining > 1e-7) {
      const point = { ...actor.position },
        damage = Math.min(remaining, actor.hp);
      this.effect("attack", {
        actorId: actor.id,
        from: { ...from },
        to: point,
        boosted,
      });
      this.hit(actor, damage);
      remaining -= damage;
      if (actor.hp > 0) break;
      from = point;
      actor = this.targetPool().sort(
        (a, b) =>
          Math.hypot(a.position.x - point.x, a.position.y - point.y) -
            Math.hypot(b.position.x - point.x, b.position.y - point.y) ||
          a.id - b.id,
      )[0];
    }
  }
  refillCharges(dt) {
    if (this.charges === this.maxCharges) {
      this.chargeProgress = 0;
      return;
    }
    this.chargeProgress += dt;
    while (this.chargeProgress + 1e-9 >= 10 && this.charges < this.maxCharges) {
      this.chargeProgress = Math.max(0, this.chargeProgress - 10);
      this.charges++;
      this.note(
        `Charge restored · ${this.charges}/${this.maxCharges}.`,
        "combat",
      );
    }
    if (this.charges === this.maxCharges) this.chargeProgress = 0;
  }
  target() {
    const sorted = this.targetPool();
    const chosen = sorted.find((a) => a.id === this.selected);
    if (chosen) return chosen;
    if (this.priority === "support")
      sorted.sort(
        (a, b) =>
          Number(b.tags.includes("support")) -
            Number(a.tags.includes("support")) || a.id - b.id,
      );
    else if (this.priority === "elite")
      sorted.sort(
        (a, b) =>
          Number(b.leader) - Number(a.leader) ||
          (b.tier === "champion" ? 2 : b.tier === "elite" ? 1 : 0) -
            (a.tier === "champion" ? 2 : a.tier === "elite" ? 1 : 0) ||
          a.id - b.id,
      );
    else sorted.sort((a, b) => a.id - b.id);
    return sorted[0];
  }
  targetPool() {
    const supports = this.actors.filter((a) => a.tags.includes("support"));
    return supports.length ? supports : [...this.actors];
  }
  hit(actor, damage) {
    if (!actor) return;
    actor.hp -= damage;
    this.effect("hit", { actorId: actor.id, damage });
    if (actor.hp <= 0) this.defeat(actor);
  }
}
