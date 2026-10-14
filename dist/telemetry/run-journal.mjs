import { CombatSummary } from "./combat-summary.mjs";
import { journalLogEntries } from "./journal-log.mjs";
/** Observational event journal. It cannot mutate the game or the director. */
export class RunJournal {
  constructor() {
    this.entries = [];
    this.samples = [];
    this.serial = 0;
    this.version = 0;
    this.passive = { amount: 0, since: 0 };
    this.lastSample = -Infinity;
    this.previousHealth = 100;
    this.peakPoints = 0;
    this.peakActors = 0;
    this.spawnedGroups = 0;
    this.entryFuel = 0;
    this.passiveFuel = 0;
    this.result = null;
    this.combat = new CombatSummary((time, data, context) => {
      this.record(
        time,
        "combat-summary",
        `Combat ${data.outcome} · ${data.duration.toFixed(1)}s · ${data.healthLost.toFixed(1)} HP lost after regen · ${data.startHealth.toFixed(0)} → ${data.endHealth.toFixed(0)} HP · ${data.defeats} defeated · ${data.bursts} bursts · ${data.potions} potions`,
        data,
        context,
      );
    });
  }

  record(time, kind, text, data = {}, context = {}) {
    const entry = structuredClone({
      id: ++this.serial,
      time,
      kind,
      text,
      data,
      context,
    });
    this.entries.push(entry);
    this.version++;
    return entry;
  }

  flushPassive(time, context) {
    if (this.passive.amount <= 0) return;
    this.record(
      time,
      "fuel",
      `Passive flow released ${this.passive.amount.toFixed(2)} points`,
      {
        amount: this.passive.amount,
        reason: "passive",
        since: this.passive.since,
      },
      context,
    );
    this.passive = { amount: 0, since: time };
  }

  directorEvent(event, context) {
    const { time, type } = event;
    if (type === "fuel-transferred" && event.reason === "passive") {
      this.passive.amount += event.amount;
      this.passiveFuel += event.amount;
      if (time - this.passive.since >= 1 - 1e-7)
        this.flushPassive(time, context);
      return;
    }
    this.flushPassive(time, context);
    if (type === "fuel-added")
      this.record(
        time,
        "fuel",
        `Introduced ${event.amount.toFixed(1)} points`,
        event,
        context,
      );
    if (type === "fuel-transferred") {
      if (event.reason === "room-entry") this.entryFuel += event.amount;
      this.record(
        time,
        "fuel",
        `${event.reason}: released ${event.amount.toFixed(1)} points`,
        event,
        context,
      );
    }
    if (type === "group-prepared")
      this.record(
        time,
        "director",
        `Prepared group #${event.group.id} · ${event.group.cost.toFixed(1)} points`,
        event,
        context,
      );
    if (type === "menu-changed")
      this.record(
        time,
        "director",
        `Configuration ${event.configId} · prepared group ${event.preservedPlan ?? "none"} retained`,
        event,
        context,
      );
    if (type === "spawn-committed") {
      this.spawnedGroups++;
      this.record(
        time,
        "arrival",
        `${event.group.intent === "breach" ? "Seal breached · " : ""}${event.group.members.length} units arrived · ${event.group.cost.toFixed(1)} points · ${event.entrance}`,
        event,
        context,
      );
    }
    if (type === "warning-started")
      this.record(
        time,
        "director",
        `Passive forecast · ${event.attempt.entrance}`,
        event,
        context,
      );
    if (type === "dispatch-canceled")
      this.record(
        time,
        "director",
        `Forecast canceled · ${event.reason}`,
        event,
        context,
      );
    if (type === "final-spend-start")
      this.record(
        time,
        "director",
        `Final spend · ${event.reason}`,
        event,
        context,
      );
    if (type === "final-spend-complete")
      this.record(
        time,
        "director",
        `Queue flushed · ${event.unused.toFixed(2)} unused`,
        event,
        context,
      );
    if (
      [
        "cards-filtered",
        "list-refilled",
        "card-drawn",
        "selection-fallback",
        "selection-canceled",
      ].includes(type)
    )
      this.record(
        time,
        "director",
        `${type} · ${event.cardId ?? event.listId ?? event.groupId}`,
        event,
        context,
      );
    if (type === "composition-error")
      this.record(time, "director", event.message, event, context);
    if (type === "fuel-drained")
      this.record(
        time,
        "director",
        `No more groups scheduled · ${event.unused.toFixed(2)} unspendable fuel remains`,
        event,
        context,
      );
  }

  observe(time, state, context, force = false) {
    this.combat.observe(time, state, context);
    this.peakPoints = Math.max(this.peakPoints, state.points);
    this.peakActors = Math.max(this.peakActors, state.actors);
    if (!force && time - this.lastSample < 1 - 1e-7) return;
    const delta = state.health - this.previousHealth;
    if (Math.abs(delta) > 0.05)
      this.record(
        time,
        "health",
        `${delta < 0 ? "Health lost" : "Health recovered"} ${Math.abs(delta).toFixed(1)} · ${state.health.toFixed(1)} HP`,
        {
          delta,
          health: state.health,
          incomingDps: state.incomingDps,
          points: state.points,
        },
        context,
      );
    this.samples.push(structuredClone({ time, ...state }));
    this.previousHealth = state.health;
    this.lastSample = time;
  }

  complete(time, outcome, metrics, context) {
    if (this.result) return;
    this.combat.finish(time, outcome);
    this.flushPassive(time, context);
    this.result = structuredClone({ ...metrics, outcome });
    this.record(time, "result", `Run ${outcome}`, this.result, context);
  }

  snapshot() {
    const latest = this.samples.at(-1)?.time ?? 0;
    const log = journalLogEntries(this.entries);
    return structuredClone({
      version: this.version,
      entries: log.slice(-300),
      timelineEntries: this.entries.filter((e) => e.time >= latest - 120),
      totalEntries: log.length,
      rawEventCount: this.entries.length,
      samples: this.samples.filter((s) => s.time >= latest - 120),
      result: this.result,
    });
  }

  export() {
    return structuredClone({
      entries: this.entries,
      samples: this.samples,
      result: this.result,
    });
  }
}
