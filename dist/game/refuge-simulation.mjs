import { RunJournal } from "../telemetry/run-journal.mjs";
import { formatJournalLog } from "../telemetry/journal-log.mjs";
import { createViewState, createArenaState } from "./view-state.mjs";
import { createRandom } from "./random.mjs";
import { ZoneHost } from "./zone-host.mjs";
import { CombatModel } from "./combat-model.mjs";
import { resolvePlayerStats } from "./player-stats.mjs";
import { scriptedLeaderStats } from "./scripted-leaders.mjs";
import { APP_VERSION } from "../version.mjs";
import { steadyReservesReady, BURST_STRATEGIES } from "./player-policy.mjs";
import { createSpawnAdapter, canSpawnAtPortal } from "./spawn-adapter.mjs";
import { EncounterManager } from "../core/encounter-manager.mjs";
import { AREAS, APPROACHES, MENUS, BOSSES, configFor } from "../demo-data.mjs";
/** Demo-only combat/progression host. Does not inherit from the manager. */
export class RefugeSimulation {
  constructor(opts = {}) {
    this.seed = opts.seed ?? 1;
    this.depth = opts.depth || 1;
    this.playerStats = resolvePlayerStats({
      ...opts.playerStats,
      ...(opts.power === undefined ? {} : { power: opts.power }),
    });
    this.power = this.playerStats.power;
    this.personality = opts.personality || "balanced";
    this.approach = opts.approach || "steady";
    this.route = opts.route || "required";
    this.autoAdvance = opts.autoAdvance ?? true;
    this.priority = "nearest";
    this.burstStrategy = opts.burstStrategy ?? "health";
    if (!BURST_STRATEGIES[this.burstStrategy])
      throw new Error("Invalid last-charge strategy");
    this.selectionMode = opts.selectionMode ?? "random";
    this.bossTiming = { longSeconds: 10, shortSeconds: 6, ...opts.bossTiming };
    this.reset();
  }
  reset(sanctum = false) {
    this.random = createRandom(this.seed);
    this.journal = new RunJournal();
    Object.assign(this, {
      sanctum,
      area: sanctum ? "liath" : "entry",
      sub: 0,
      enteredAt: 0,
      t: 0,
      pendingActors: new Map(),
      serial: 0,
      log: [],
      effects: [],
      history: [],
      lieutenants: [],
      earned: 0,
      finalDefeated: false,
      ended: false,
      failed: false,
      stepRemainder: 0,
      restTime: 0,
      peakCrowd: 0,
      breaches: 0,
      hold: false,
      events: new Set(),
      bossChoice: BOSSES[Math.floor(this.random() * BOSSES.length)],
      entrances: [
        { id: "rear", name: "Rear arch", open: true },
        { id: "front", name: "Front gate", open: true },
        { id: "side", name: "Side breach", open: false },
      ],
      lastAttack: 0,
      lastBanner: null,
      victoryReady: false,
    });
    this.combat = new CombatModel({
      power: this.power,
      stats: this.playerStats,
      priority: this.priority,
      burstStrategy: this.burstStrategy,
      onEvent: (e) => {
        if (e.kind === "message") this.note(e.text, e.type);
        else {
          const { kind, ...data } = e;
          this.effect(kind, data);
        }
      },
      onDefeat: (a) => this.onDefeat(a),
    });
    this.zone = new ZoneHost(
      AREAS.filter((a) => (sanctum ? a.id === "liath" : a.id !== "liath")),
      this.depth,
      this.bossTiming,
    );
    this.manager = new EncounterManager({
      config: configFor(
        this.areaDef().menu,
        this.personality,
        this.depth,
        0,
        this.selectionMode,
      ),
      selectionSeed: this.seed,
      runtime: { warningLeadSeconds: 6, budgetAwareComposition: true },
    });
    this.consumeEvents();
    this.journal.record(
      0,
      "player-settings",
      "Player stats at run start",
      this.playerStats,
      this.context(),
    );
    this.journal.record(
      0,
      "strategy",
      "Last-charge strategy: " + BURST_STRATEGIES[this.burstStrategy].name,
      { burstStrategy: this.burstStrategy },
      this.context(),
    );
    this.enter(this.area, 0, "Player entry");
  }
  get actors() {
    return this.combat.actors;
  }
  set actors(v) {
    this.combat.actors = v;
  }
  get hp() {
    return this.combat.hp;
  }
  set hp(v) {
    this.combat.hp = v;
  }
  get kills() {
    return this.combat.kills;
  }
  set kills(v) {
    this.combat.kills = v;
  }
  get charges() {
    return this.combat.charges;
  }
  set charges(v) {
    this.combat.charges = v;
  }
  get chargeProgress() {
    return this.combat.chargeProgress;
  }
  set chargeProgress(v) {
    this.combat.chargeProgress = v;
  }
  get burstCount() {
    return this.combat.burstCount;
  }
  set burstCount(v) {
    this.combat.burstCount = v;
  }
  get regen() {
    return this.combat.regen;
  }
  set regen(v) {
    this.combat.regen = v;
  }
  get pressurePerPoint() {
    return this.combat.pressurePerPoint;
  }
  set pressurePerPoint(v) {
    this.combat.pressurePerPoint = v;
  }
  get pulseInterval() {
    return this.combat.pulseInterval;
  }
  set pulseInterval(v) {
    this.combat.pulseInterval = v;
  }
  get attackProgress() {
    return this.combat.attackProgress;
  }
  set attackProgress(v) {
    this.combat.attackProgress = v;
  }
  get minHp() {
    return this.combat.minHp;
  }
  set minHp(v) {
    this.combat.minHp = v;
  }
  get selected() {
    return this.combat.selected;
  }
  set selected(v) {
    this.combat.selected = v;
  }
  livingCost(...args) {
    this.combat.power = this.power;
    this.combat.priority = this.priority;
    return this.combat.livingCost(...args);
  }
  incomingDps(...args) {
    this.combat.power = this.power;
    this.combat.priority = this.priority;
    return this.combat.incomingDps(...args);
  }
  moveActors(...args) {
    this.combat.power = this.power;
    this.combat.priority = this.priority;
    return this.combat.moveActors(...args);
  }
  pulse(...args) {
    this.combat.power = this.power;
    this.combat.priority = this.priority;
    return this.combat.pulse(...args);
  }
  refillCharges(...args) {
    this.combat.power = this.power;
    this.combat.priority = this.priority;
    return this.combat.refillCharges(...args);
  }
  target(...args) {
    this.combat.power = this.power;
    this.combat.priority = this.priority;
    return this.combat.target(...args);
  }
  hit(...args) {
    this.combat.power = this.power;
    this.combat.priority = this.priority;
    return this.combat.hit(...args);
  }
  defeat(...args) {
    this.combat.power = this.power;
    this.combat.priority = this.priority;
    return this.combat.defeat(...args);
  }
  get potential() {
    return this.manager.potential;
  }
  get available() {
    return this.manager.available;
  }
  get added() {
    return this.manager.introduced;
  }
  get spent() {
    return this.manager.spent;
  }
  get next() {
    return this.manager.next;
  }
  get dispatch() {
    return this.manager.dispatch;
  }
  get pending() {
    return this.manager.pending;
  }
  get lastSpawn() {
    return this.manager.lastSpawn;
  }
  get volumes() {
    return this.zone.rooms;
  }
  get sweepComplete() {
    return this.manager.finalComplete || this.manager.budgetComplete;
  }
  get draining() {
    return this.manager.finalSpend;
  }
  get wait() {
    return this.manager.wait;
  }
  get menu() {
    return this.manager.config.menu;
  }
  flow() {
    return this.manager.config.flowRate;
  }
  recoveryRemaining() {
    return this.manager.recoveryRemaining();
  }
  areaDef() {
    return AREAS.find((a) => a.id === this.area);
  }
  current() {
    return this.volumes.find((v) => v.id === this.area + ":" + this.sub);
  }
  lastSub() {
    return this.sub === this.areaDef().parts.length - 1;
  }
  note(text, type = "event") {
    if (
      !this.readingDirector &&
      !(type === "combat" && text.startsWith("Burst"))
    )
      this.journal.record(
        this.t,
        type === "combat"
          ? "recovery"
          : type === "reward"
            ? "progression"
            : type === "error"
              ? "result"
              : "progression",
        text,
        {},
        this.context(),
      );
    this.log.unshift({ t: this.t, text, type });
    this.log = this.log.slice(0, 180);
  }
  effect(type, data = {}) {
    if (type === "potion-used" || type === "potion-refilled")
      this.journal.record(
        this.t,
        "potion",
        type === "potion-used"
          ? `Potion restored ${data.healing.toFixed(0)} HP · ${data.health.toFixed(1)} HP`
          : `Potion refilled · ${data.reason === "scripted-leader" ? "scripted leader defeated" : "30 fuel of enemies defeated"}`,
        { type, ...data },
        this.context(),
      );
    if (type === "burst")
      this.journal.record(
        this.t,
        "burst",
        "Charged pulse ×4",
        data,
        this.context(),
      );
    this.effects.push({
      type,
      time: this.t,
      roomId: this.current().id,
      ...data,
    });
    this.effects = this.effects.slice(-150);
  }
  consumeEvents() {
    this.readingDirector = true;
    for (const e of this.manager.drainEvents()) {
      this.journal.directorEvent(e, this.context());
      if (e.type === "spawn-committed") {
        this.effect("arrival", { portalId: e.entrance });
        if (e.group.intent === "breach")
          this.note(
            `Seal breached · ${e.entrance} · ${e.group.cost.toFixed(1)} fuel.`,
            "milestone",
          );
        for (const id of e.actorIds) {
          const a = this.pendingActors.get(id);
          this.actors.push(a);
          this.pendingActors.delete(id);
        }
        this.journal.combat.arrival(
          this.t,
          this.observation(),
          this.context(),
          {
            groups: 1,
            fuel: e.group.cost,
          },
        );
        this.combat.onArrival();
        this.observe(true);
        this.note(
          `${e.group.members.length} defenders via ${e.entrance}; ${e.group.cost.toFixed(1)} fuel (${e.origin}).`,
          "spawn",
        );
      }
      if (e.type === "warning-started")
        this.note(
          `Passive funding forecast · ${e.attempt.entrance}.`,
          "warning",
        );
      if (e.type === "dispatch-canceled")
        this.note(`Arrival canceled: ${e.reason}; no fuel spent.`);
      if (e.type === "final-spend-start")
        this.note(
          `FINAL SPEND · ${e.reason}. Old commitment flushed; affordable ad hoc units permitted.`,
          "warning",
        );
      if (e.type === "final-spend-complete")
        this.note(
          `Queue flushed. ${e.unused.toFixed(1)} sub-cheapest fuel unused.`,
          "milestone",
        );
      if (e.type === "volume-finished")
        this.note(`${e.id} Finished milestone.`, "milestone");
      if (e.type === "composition-error") this.note(e.message, "error");
    }
    this.readingDirector = false;
    this.observe();
  }
  adapter() {
    return createSpawnAdapter(this);
  }
  canEnter(plan, id) {
    return canSpawnAtPortal(this, plan, id);
  }
  enter(area, index, cause) {
    const departure = this.sceneSnapshot({ includeDeparture: false });
    const config = configFor(
      AREAS.find((a) => a.id === area).menu,
      this.personality,
      this.depth,
      index,
      this.selectionMode,
    );
    if (!this.zone.enter(area, index, this.manager, config, cause, this.t))
      return false;
    this.area = area;
    this.departureScene = departure;
    this.sub = index;
    this.enteredAt = this.t;
    this.entrances = this.zone.portals;
    this.journal.record(
      this.t,
      "room",
      "Entered " + this.current().name,
      {
        zone: area,
        room: this.current().id,
        released: this.current().released,
        requested: this.current().entryReleaseRequest,
      },
      this.context(),
    );
    this.note(
      `Entered ${this.areaDef().name} · ${index + 1}/${this.areaDef().parts.length}: ${this.current().name}. Released ${this.current().released.toFixed(1)} zone fuel.`,
    );
    if (index === 0)
      this.note(
        `Zone activated: ${this.areaDef().budget} points · passive flow ${config.flowRate}/s.`,
      );
    this.updateBoss();
    this.consumeEvents();
    return true;
  }

  spawnPosition(slot) {
    const portal = this.entrances.find((e) => e.slot === slot);
    return portal ? { ...portal.position } : { x: 0.5, y: 0.3 };
  }
  spawnLeader(key, name, metadata = {}) {
    const stats = scriptedLeaderStats(key);
    this.actors.push({
      id: ++this.serial,
      key,
      name,
      ...stats,
      tier: "champion",
      menu: this.areaDef().menu,
      tags: ["boss"],
      leader: true,
      originVolume: this.current().id,
      entrance: "stage",
      position: this.spawnPosition("stage"),
      spawnPoint: this.spawnPosition("stage"),
      age: 0,
      footprint: 3,
      ...metadata,
    });
    this.effect("boss", { name });
    this.journal.record(
      this.t,
      "arrival",
      `Scripted leader arrived · ${name} · ${stats.fuelEquivalent} equivalent · ${stats.hp} HP · ${(stats.cost * this.pressurePerPoint * stats.damageMultiplier).toFixed(2)} DPS · outside Director fuel`,
      { scriptedLeader: true, key, ...stats },
      this.context(),
    );
    this.journal.combat.arrival(this.t, this.observation(), this.context(), {
      scriptedLeaders: 1,
    });
    this.combat.onArrival();
  }

  updateBoss() {
    const zone = this.zone.currentZone;
    if (!zone || zone.id === "entry") return;
    const clock = zone.bossClock,
      before = clock.snapshot();
    const due = clock.update(this.t, {
      lastRoomEntered: this.lastSub() && this.actors.length > 0,
      zoneComplete:
        !this.actors.length &&
        !this.manager.next &&
        !this.manager.dispatch &&
        this.sweepComplete,
    });
    if (clock.deadline !== before.deadline)
      this.journal.record(
        this.t,
        "progression",
        `Boss countdown · ${clock.mode} · ${Math.max(0, clock.deadline - this.t).toFixed(1)}s remaining`,
        clock.snapshot(),
        this.context(),
      );
    if (due)
      this.spawnLeader(
        this.area,
        this.area === "boss" ? this.bossChoice : MENUS[this.area].name,
      );
  }

  destinations() {
    if (this.sanctum || this.ended || !this.lastSub()) return [];
    if (this.area === "entry") return ["a"];
    if (this.area === "a") return ["c", "b1", "b2"];
    if (this.area === "b1") return ["c", "b2"];
    if (this.area === "b2") return ["c"];
    if (this.area === "c")
      return this.lieutenants.includes("a") && this.lieutenants.includes("c")
        ? ["boss"]
        : [];
    return [];
  }
  routeNext() {
    const d = this.destinations();
    if (this.route === "full")
      for (const id of ["b1", "b2"])
        if (d.includes(id) && !this.lieutenants.includes(id)) return id;
    return d.find((id) => ["a", "c", "boss"].includes(id)) || d[0];
  }
  gateReady() {
    return (
      !this.lastSub() ||
      this.area === "entry" ||
      (["a", "b1", "b2", "c"].includes(this.area) &&
        this.lieutenants.includes(this.area) &&
        this.sweepComplete)
    );
  }
  advance(early = false, to = null) {
    if (this.failed || this.ended || !this.gateReady()) return false;
    const area = this.lastSub() ? to || this.routeNext() : this.area,
      index = this.lastSub() ? 0 : this.sub + 1;
    if (!area || (this.lastSub() && !this.destinations().includes(area)))
      return false;
    if (early) this.breaches++;
    this.effect("door");
    return this.enter(
      area,
      index,
      early ? "Crystal breach" : "Player movement",
    );
  }
  faceGuardian(to = null) {
    const key = "guardian-" + this.area;
    if (
      !this.lastSub() ||
      !this.gateReady() ||
      this.events.has(key) ||
      this.area === "entry"
    )
      return;
    this.events.add(key);
    this.spawnLeader(key, "Linked Crystal Guardian", {
      doorTo: to || this.routeNext(),
      doorFrom: this.area,
    });
  }
  releaseHere() {
    const n = this.manager.transfer(Infinity, "zone:" + this.area);
    if (n) this.manager.requestSpawn();
    this.note(
      n
        ? `Released ${n.toFixed(1)} zone fuel.`
        : "No unreleased zone fuel. Advance to the next subarea.",
    );
    return n;
  }
  chest() {
    if (
      this.draining ||
      !this.manager.applyOnce("optional-chest", {
        add: 24,
        transfer: 15,
        trigger: true,
      })
    )
      return;
    this.note("Optional chest: +24 authored fuel.");
    this.consumeEvents();
  }
  get progression() {
    return this.autoAdvance ? this.approach : "manual";
  }
  setProgression(id) {
    if (id !== "manual" && !APPROACHES[id])
      throw new Error("Unknown progression mode");
    if (this.progression === id) return false;
    this.autoAdvance = id !== "manual";
    if (this.autoAdvance) this.approach = id;
    this.hold = false;
    this.note(
      "Progression → " + (id === "manual" ? "Manual" : APPROACHES[id].name),
    );
    return true;
  }
  toggleAdvancement() {
    if (!this.autoAdvance || this.failed || this.ended || this.victoryReady)
      return false;
    this.hold = !this.hold;
    this.note(
      this.hold
        ? "Advancement stopped; combat and recovery continue."
        : "Automatic approach resumed.",
    );
    return true;
  }
  restart() {
    this.reset(this.sanctum);
  }
  setApproach(id) {
    if (APPROACHES[id]) {
      this.approach = id;
      this.note("Approach → " + APPROACHES[id].name);
    }
  }
  setPersonality(id) {
    this.personality = id;
    this.manager.updateConfig(
      configFor(this.menu, id, this.depth, this.sub, this.selectionMode),
    );
    this.consumeEvents();
  }
  setSelectionMode(mode) {
    if (!["ordered", "random"].includes(mode))
      throw new Error("Invalid selection mode");
    this.selectionMode = mode;
    this.manager.updateConfig({
      ...this.manager.config,
      selection: { ...this.manager.config.selection, mode },
    });
    this.consumeEvents();
  }
  setMenu(id) {
    if (this.draining) return;
    this.manager.updateConfig({
      ...configFor(
        id,
        this.personality,
        this.depth,
        this.sub,
        this.selectionMode,
      ),
      flowRate: this.areaDef().flowRate,
    });
    this.consumeEvents();
  }
  invalidate() {
    this.manager.invalidate();
    this.consumeEvents();
  }
  trigger() {
    this.manager.requestSpawn();
  }
  toggleEntrance(id) {
    const e = this.zone.toggle(id);
    this.manager.updatePortals(this.zone.descriptors());
    this.note(e.name + (e.enabled !== false ? " enabled." : " blocked."));
  }
  onDefeat(actor) {
    // Observe the first empty instant before leader callbacks can enter a room.
    this.observe();
    this.manager.notifyDefeat(actor.id);
    if (!actor.leader) return;
    this.note(actor.name + " defeated.", "reward");
    this.lastBanner = { name: actor.name, time: this.t };
    if (actor.doorTo && this.area === actor.doorFrom)
      this.advance(false, actor.doorTo);
    if (["a", "b1", "b2", "c"].includes(actor.key)) {
      this.lieutenants.push(actor.key);
      if (this.lieutenants.length === 1 || this.lieutenants.length === 4) {
        this.earned++;
        this.effect("keystone");
      }
    }
    if (actor.key === "boss") {
      this.finalDefeated = true;
      this.earned++;
      this.effect("keystone");
    }
    if (actor.key === "liath") this.finalDefeated = true;
  }
  canSafe() {
    return (
      !this.actors.length &&
      !this.dispatch &&
      (this.sweepComplete ||
        !this.next ||
        this.available + 1e-7 < this.next.cost)
    );
  }
  approachReady() {
    if (this.approach === "charge") return true;
    if (this.dispatch) return false;
    if (this.actors.length) return false;
    if (this.approach === "steady")
      return steadyReservesReady({
        hp: this.hp,
        maxHp: this.combat.maxHp,
        charges: this.charges,
      });
    return true;
  }
  progressStatus() {
    if (this.ended) return "Victory · earned Keystones banked.";
    if (this.failed)
      return "Overwhelmed · pressure exhausted your reserves. Try resting before the next door.";
    if (this.finalDefeated)
      return this.sweepComplete
        ? "Victory · return and bank your rewards."
        : "Victory · spending the final fuel.";
    if (!this.autoAdvance || this.hold)
      return "Holding position · combat, passive regeneration and charge recovery continue.";
    const clock = this.zone.currentZone.bossClock;
    if (clock.deadline !== null && !clock.spawned)
      return `Lieutenant arriving in ${Math.max(0, clock.deadline - this.t).toFixed(1)}s · ${clock.mode === "short" ? "zone opposition cleared" : "last-chamber countdown"}.`;
    if (!this.gateReady())
      return "Lieutenant checkpoint · defeat the lieutenant and finish spending fuel.";
    if (this.approach !== "charge" && this.dispatch)
      return "Incoming wave telegraphed · waiting here for its arrival.";
    if (!this.approachReady())
      return this.approach === "steady"
        ? `Slow and steady · clear all enemies, then ${this.combat.maxHp * 0.7}+ HP with 2 charges, or full health with 1 charge.`
        : "Press forward · clear all enemies, then advance immediately without resting.";
    return (
      "Next: " +
      (this.lastSub()
        ? AREAS.find((a) => a.id === this.routeNext())?.name
        : this.areaDef().parts[this.sub + 1][0]) +
      "."
    );
  }
  tick(dt) {
    if (!Number.isFinite(dt) || dt < 0)
      throw new Error("Invalid simulation time");
    this.stepRemainder += dt;
    while (this.stepRemainder + 1e-9 >= 0.05) {
      this.stepRemainder -= 0.05;
      this.step(0.05);
      if (this.ended || this.failed || this.victoryReady) {
        this.stepRemainder = 0;
        break;
      }
    }
  }
  step(dt) {
    if (this.ended || this.failed || this.victoryReady) return;
    this.t += dt;
    this.manager.updatePortals(this.zone.descriptors());
    this.manager.tick(dt, this.adapter());
    this.consumeEvents();
    this.combat.power = this.power;
    this.combat.priority = this.priority;
    if (!this.combat.step(this.t, dt)) {
      this.failed = true;
      this.observe(true);
      this.note("Overwhelmed: no health remaining.", "error");
      this.journal.complete(
        this.t,
        "overwhelmed",
        this.runMetrics(),
        this.context(),
      );
      return;
    }
    this.zone.observeQuiet(this.manager, this.t);
    this.updateBoss();
    this.peakCrowd = Math.max(this.peakCrowd, this.actors.length);
    if (!this.actors.length) this.restTime += dt;
    this.history.push({
      t: this.t,
      p: this.potential,
      a: this.available,
      n: this.actors.length,
      hp: this.hp,
      charges: this.charges,
      cost: this.livingCost(),
    });
    if (this.history.length > 2400) this.history.shift();
    this.effects = this.effects.filter((e) => this.t - e.time < 2);
    if (
      this.autoAdvance &&
      !this.hold &&
      this.t - this.enteredAt >= APPROACHES[this.approach].dwell &&
      this.approachReady() &&
      this.gateReady()
    ) {
      if (this.lastSub() && this.area !== "entry" && this.approach === "steady")
        this.faceGuardian();
      else this.advance(this.approach === "charge" || this.area === "entry");
    }
    this.victoryReady =
      this.finalDefeated && this.sweepComplete && !this.actors.length;
    this.observe();
    if (this.victoryReady)
      this.journal.complete(
        this.t,
        "complete",
        this.runMetrics(),
        this.context(),
      );
  }

  finish() {
    if (!this.finalDefeated || !this.sweepComplete || this.ended) return false;
    this.journal.complete(
      this.t,
      this.actors.length ? "returned" : "complete",
      this.runMetrics(),
      this.context(),
    );
    this.manager.end();
    this.actors = [];
    this.pendingActors.clear();
    this.ended = true;
    this.note(
      `Return: ${this.earned} Keystones · ${this.kills} defeats · peak crowd ${this.peakCrowd}.`,
      "reward",
    );
    return true;
  }
  excludeBoss(name) {
    if (
      this.events.has("boss-exclusion") ||
      (this.area === "boss" && this.lastSub())
    )
      return;
    this.events.add("boss-exclusion");
    const pool = BOSSES.filter((n) => n !== name);
    this.bossChoice = pool[Math.floor(this.random() * pool.length)];
  }
  context() {
    return {
      zone: this.area,
      room: this.area + ":" + this.sub,
      roomName: this.current()?.name ?? "",
    };
  }
  observe(force = false) {
    this.journal.observe(this.t, this.observation(), this.context(), force);
  }
  observation() {
    return {
      health: this.hp,
      points: this.livingCost(),
      actors: this.actors.length,
      incomingDps: this.incomingDps(),
      potential: this.potential,
      available: this.available,
      bursts: this.burstCount,
      defeats: this.kills,
      potionsUsed: this.combat.potionsUsed,
      potionHealing: this.combat.potionHealing,
    };
  }
  runMetrics() {
    return structuredClone(
      this.journal.result ?? {
        outcome: this.failed
          ? "overwhelmed"
          : this.victoryReady || this.ended
            ? "complete"
            : "in-progress",
        elapsed: this.t,
        quietTime: this.restTime,
        minimumHealth: this.minHp,
        health: this.hp,
        peakLivingPoints: this.journal.peakPoints,
        peakActors: this.journal.peakActors,
        bursts: this.burstCount,
        potionsUsed: this.combat.potionsUsed,
        potionHealing: this.combat.potionHealing,
        potionKillRefills: this.combat.potionKillRefills,
        potionLeaderRefills: this.combat.potionLeaderRefills,
        defeats: this.kills,
        groups: this.journal.spawnedGroups,
        entryFuel: this.journal.entryFuel,
        passiveFuel: this.journal.passiveFuel,
        fuelIntroduced: this.added,
        fuelSpent: this.spent,
        fuelUnused: this.potential + this.available,
        earnedKeystones: this.earned,
        defendersRemaining: this.actors.length,
        progression: this.progression,
        personality: this.personality,
        burstStrategy: this.burstStrategy,
        selectionMode: this.selectionMode,
        route: this.route,
        depth: this.depth,
        seed: this.seed,
        scriptedLeadersOutsideFuel: true,
        playerStats: this.playerStats,
      },
    );
  }
  viewState() {
    return createViewState(this);
  }
  sceneSnapshot({ includeDeparture = true } = {}) {
    return structuredClone({
      departure: includeDeparture ? (this.departureScene ?? null) : null,
      location: {
        roomId: this.current().id,
        zoneId: this.area,
        zoneName: this.areaDef().name,
        roomName: this.current().name,
      },
      time: this.t,
      arena: createArenaState(this),
      actors: this.actors,
      effects: this.effects.filter((e) => e.roomId === this.current().id),
      selected: this.selected,
    });
  }
  exportTrace() {
    this.journal.flushPassive(this.t, this.context());
    return {
      spec: `Mage's Refuge v${APP_VERSION} · Encounter Director selection v17`,
      settings: {
        depth: this.depth,
        personality: this.personality,
        selectionMode: this.selectionMode,
        progression: this.progression,
        burstStrategy: this.burstStrategy,
        route: this.route,
        seed: this.seed,
        playerStats: this.playerStats,
        bossTiming: this.bossTiming,
      },
      results: this.runMetrics(),
      director: this.manager.snapshot(),
      zone: this.zone.snapshot(),
      journal: this.journal.export(),
    };
  }
  exportJournalLog() {
    return (
      `Mage's Refuge v${APP_VERSION} · ${this.progression} · ${this.burstStrategy} charges · ${this.personality} · seed ${this.seed}\n` +
      formatJournalLog(this.journal.entries)
    );
  }
  isTerminal() {
    return this.failed || this.ended || this.victoryReady;
  }
  selectTarget(id) {
    if (this.actors.some((a) => a.id === id)) this.selected = id;
  }
  setPriority(id) {
    if (!["nearest", "support", "elite"].includes(id))
      throw new Error("Invalid priority");
    this.priority = id;
    this.selected = null;
  }
  setBurstStrategy(id) {
    if (!BURST_STRATEGIES[id]) throw new Error("Invalid last-charge strategy");
    if (id === this.burstStrategy) return false;
    this.burstStrategy = id;
    this.combat.burstStrategy = id;
    this.combat.emergencyBurstPending = false;
    this.journal.record(
      this.t,
      "strategy",
      "Last-charge strategy: " + BURST_STRATEGIES[id].name,
      { burstStrategy: id },
      this.context(),
    );
    return true;
  }
  setRoute(id) {
    if (!["required", "full"].includes(id)) throw new Error("Invalid route");
    this.route = id;
    this.note("Route → " + id);
  }
  restartAtDepth(depth, sanctum = this.sanctum, stats = this.playerStats) {
    const resolved = resolvePlayerStats(stats);
    this.playerStats = resolved;
    this.power = resolved.power;
    this.depth = Math.max(1, Math.min(10, Number(depth) || 1));
    this.reset(sanctum);
  }
  bossChoices() {
    return [...BOSSES];
  }

  snapshot() {
    return {
      time: this.t,
      actors: structuredClone(this.actors),
      effects: structuredClone(this.effects),
      selected: this.selected,
      health: this.hp,
      charges: this.charges,
      chargeProgress: this.chargeProgress,
      incomingDps: this.incomingDps(),
      regen: this.regen,
      burstCount: this.burstCount,
      manager: this.manager.snapshot(),
      zone: this.zone.snapshot(),
      area: this.area,
      sub: this.sub,
      peakCrowd: this.peakCrowd,
    };
  }
}
