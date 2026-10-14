import assert from "node:assert/strict";
import { RefugeSimulation } from "./dist/game/refuge-simulation.mjs";
import { RunJournal } from "./dist/telemetry/run-journal.mjs";
import { formatJournalLog } from "./dist/telemetry/journal-log.mjs";
let checks = 0;
const test = (name, fn) => {
  fn();
  checks++;
  console.log("PASS " + name);
};

function warned(approach) {
  const s = new RefugeSimulation({ approach, autoAdvance: false });
  s.tick(0.05);
  for (const a of [...s.actors]) s.hit(a, 99999);
  for (let i = 0; i < 300 && !s.dispatch; i++) s.tick(0.05);
  assert.ok(s.dispatch, "fixture must have a real pending forecast");
  assert.equal(s.actors.length, 0);
  return s;
}

test("demo forecasts six seconds before passive affordability", () => {
  const s = warned("press");
  assert.equal(s.manager.runtime.warningLeadSeconds, 6);
  const eta = s.manager.fundingEta();
  assert.ok(eta <= 6 + 1e-7 && eta > 5.9);
  const started = s.t;
  s.tick(eta - 0.05);
  assert.equal(s.actors.length, 0);
  s.tick(0.1);
  assert.ok(s.actors.length > 0);
  assert.ok(s.t - started < 6.1);
});
test("Steady and Press wait in the room for an active warning", () => {
  for (const approach of ["steady", "press"]) {
    const s = warned(approach);
    s.autoAdvance = true;
    s.hp = 100;
    s.charges = 2;
    const room = s.sub;
    assert.equal(s.approachReady(), false);
    assert.match(s.progressStatus(), /telegraphed/);
    s.tick(1);
    assert.equal(s.sub, room);
    assert.ok(s.dispatch);
  }
});
test("canceling a warning restores automatic progression without a dwell", () => {
  for (const approach of ["steady", "press"]) {
    const s = warned(approach);
    s.autoAdvance = true;
    s.manager.updateConfig({ ...s.manager.config, flowRate: 0 });
    s.tick(0.05);
    assert.equal(s.dispatch, null);
    assert.equal(s.sub, 1);
  }
});
test("manual movement can still deliberately release fuel during a warning", () => {
  const s = warned("press");
  assert.equal(s.advance(), true);
  assert.equal(s.sub, 1);
  s.tick(0.05);
  assert.ok(s.actors.length > 0);
  assert.equal(s.dispatch, null);
});
test("Charge can move during a warning and early funding never waits six seconds", () => {
  const s = warned("charge");
  s.autoAdvance = true;
  s.enteredAt = s.t - 2;
  s.tick(0.05);
  assert.equal(s.sub, 1);
  s.tick(0.05);
  assert.ok(s.actors.length > 0);
});

const state = (overrides = {}) => ({
  health: 100,
  actors: 2,
  points: 20,
  incomingDps: 4.8,
  potential: 60,
  available: 0,
  bursts: 0,
  defeats: 0,
  potionsUsed: 0,
  potionHealing: 0,
  ...overrides,
});
const context = { room: "entry:0", roomName: "Beacon Landing" };
test("overlapping groups produce one combat summary on first empty instant", () => {
  const j = new RunJournal();
  j.combat.arrival(1, state(), context, { groups: 1, fuel: 20 });
  j.observe(2, state({ health: 90, bursts: 1 }), context);
  j.combat.arrival(
    3,
    state({ health: 90, actors: 4, points: 30, bursts: 1 }),
    context,
    { groups: 1, fuel: 10 },
  );
  assert.equal(j.entries.filter((e) => e.kind === "combat-summary").length, 0);
  j.observe(
    4,
    state({ health: 70, actors: 0, points: 0, bursts: 2, defeats: 4 }),
    context,
  );
  j.observe(
    4.05,
    state({ health: 70.25, actors: 0, points: 0, bursts: 2, defeats: 4 }),
    context,
  );
  const summaries = j.entries.filter((e) => e.kind === "combat-summary");
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].time, 4);
  const d = summaries[0].data;
  assert.equal(d.duration, 3);
  assert.equal(d.groups, 2);
  assert.equal(d.fuel, 30);
  assert.equal(d.healthLost, 30);
  assert.equal(d.bursts, 2);
  assert.equal(d.defeats, 4);
  assert.equal(d.peakActors, 4);
});
test("potion healing and passive recovery cannot conceal combat health loss", () => {
  const j = new RunJournal();
  j.observe(1, state(), context);
  j.observe(
    2,
    state({ health: 70, potionsUsed: 1, potionHealing: 40 }),
    context,
  );
  j.observe(
    3,
    state({
      health: 80,
      actors: 0,
      points: 0,
      potionsUsed: 1,
      potionHealing: 40,
    }),
    context,
  );
  const d = j.entries.find((e) => e.kind === "combat-summary").data;
  assert.equal(d.healthLost, 70);
  assert.equal(d.potionHealing, 40);
  assert.equal(d.potions, 1);
  assert.equal(d.netHealthChange, -20);
});
test("empty gap starts a distinct summary even for arrivals at the same time", () => {
  const j = new RunJournal();
  j.observe(1, state(), context);
  j.observe(2, state({ actors: 0, points: 0 }), context);
  j.observe(2, state(), { ...context, room: "entry:1" });
  j.observe(3, state({ actors: 0, points: 0 }), context);
  assert.equal(j.entries.filter((e) => e.kind === "combat-summary").length, 2);
});
test("failed combat reports interruption without claiming enemies cleared", () => {
  const s = new RefugeSimulation({ approach: "charge" });
  s.tick(20);
  assert.equal(s.failed, true);
  const summary = s.journal.entries
    .filter((e) => e.kind === "combat-summary")
    .at(-1);
  assert.equal(summary.data.outcome, "overwhelmed");
  assert.equal(summary.data.endHealth, 0);
  assert.equal(s.journal.combat.active, null);
});
test("last kill records a clear before progression can spawn new actors", () => {
  const s = new RefugeSimulation({ autoAdvance: false });
  s.tick(0.05);
  for (const a of [...s.actors]) s.hit(a, 99999);
  const summaries = s.journal.entries.filter(
    (e) => e.kind === "combat-summary",
  );
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].data.outcome, "cleared");
  assert.equal(summaries[0].time, s.t);
  s.observe();
  assert.equal(
    s.journal.entries.filter((e) => e.kind === "combat-summary").length,
    1,
  );
});
test("visible and copied logs omit pulse health refill and passive tick spam; export retains detail", () => {
  const j = new RunJournal();
  for (const kind of ["health", "burst", "recovery"])
    j.record(1, kind, "noise");
  j.record(1, "fuel", "noise", { reason: "passive", amount: 0.5 });
  j.record(1, "arrival", "Wave arrived", {}, context);
  j.record(4, "combat-summary", "Combat cleared", {}, context);
  assert.equal(j.snapshot().entries.length, 2);
  assert.equal(j.export().entries.length, 6);
  assert.equal(j.snapshot().timelineEntries.length, 6);
  const log = formatJournalLog(j.entries);
  assert.ok(!log.includes("noise"));
  assert.match(log, /00:04 \[combat-summary\] Combat cleared · Beacon Landing/);
});
test("restart clears active combat telemetry and retains six second warnings", () => {
  const s = new RefugeSimulation();
  s.tick(0.05);
  assert.ok(s.journal.combat.active);
  s.restart();
  assert.equal(s.journal.combat.active, null);
  assert.equal(s.manager.runtime.warningLeadSeconds, 6);
  assert.match(s.exportJournalLog(), /Mage's Refuge v17/);
});
console.log(
  `${checks} forecast-aware approaches and combat-journal checks passed.`,
);

