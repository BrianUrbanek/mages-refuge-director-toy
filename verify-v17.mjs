import assert from "node:assert/strict";
import { EncounterManager } from "./dist/core/encounter-manager.mjs";
import { BossClock } from "./dist/game/boss-clock.mjs";
import { CombatModel } from "./dist/game/combat-model.mjs";
import { RefugeSimulation } from "./dist/game/refuge-simulation.mjs";
import { fixture } from "./core-fixture.mjs";
let checks = 0,
  serial = 0;
const test = (name, fn) => {
  fn();
  checks++;
  console.log("PASS " + name);
};
const adapter = {
  assetsReady: () => true,
  canEnter: () => true,
  commitSpawn: (g) => ({
    success: true,
    actorIds: g.members.map(() => ++serial),
  }),
};
test("standalone breach remains its authored size even beside a small terminal tail", () => {
  const s = new RefugeSimulation({
    autoAdvance: false,
    selectionMode: "ordered",
  });
  const cfg = s.manager.config,
    breach = cfg.selection.cards.find((c) => c.kind === "breach");
  const m = new EncounterManager({
    config: { ...cfg, selection: { ...cfg.selection, cards: [breach] } },
    runtime: { budgetAwareComposition: true },
  });
  m.addPotential(10, "test");
  m.updatePortals(s.zone.descriptors());
  m.tick(0, adapter);
  assert.ok(m.next.standalone);
  assert.ok(m.next.cost < 10);
  assert.equal(m.next.foldedFuel, undefined);
  assert.equal(m.available, 0);
});
test("ordinary target and spill use lowest remaining HP with stable ties", () => {
  const c = new CombatModel();
  c.charges = 0;
  c.actors = [100, 4, 8].map((hp, i) => ({
    id: i + 1,
    hp,
    cost: 1,
    tags: [],
    position: { x: i / 3, y: 0.5 },
  }));
  c.pulse();
  assert.equal(c.kills, 2);
  assert.equal(c.actors[0].hp, 94);
});
test("support screen overrides lowest-HP choices", () => {
  const c = new CombatModel();
  c.charges = 0;
  c.actors = [
    { id: 1, hp: 1, cost: 1, tags: [], position: { x: 0.5, y: 0.5 } },
    {
      id: 2,
      hp: 100,
      cost: 1,
      tags: ["support"],
      position: { x: 0.5, y: 0.5 },
    },
  ];
  c.pulse();
  assert.equal(c.actors[0].hp, 1);
  assert.equal(c.actors[1].hp, 82);
});
test("empty lull without exhausted groups does not start a boss timer", () => {
  const clock = new BossClock();
  clock.update(100);
  assert.equal(clock.deadline, null);
});
test("short zone-completion timer starts independently of room", () => {
  const clock = new BossClock();
  assert.equal(clock.update(20, { zoneComplete: true }), false);
  assert.equal(clock.deadline, 26);
  assert.equal(clock.update(26), true);
  assert.equal(clock.update(30), false);
});
test("clearing during long timer subtracts delta instead of restarting short timer", () => {
  const clock = new BossClock();
  clock.update(20, { lastRoomEntered: true });
  clock.update(24, { zoneComplete: true });
  assert.equal(clock.deadline, 26);
  assert.equal(clock.update(26), true);
});
test("delta subtraction can cause immediate arrival and never postpones deadline", () => {
  const clock = new BossClock();
  clock.update(20, { lastRoomEntered: true });
  assert.equal(clock.update(28, { zoneComplete: true }), true);
  assert.equal(clock.deadline, 26);
});
test("long timer expires despite living opposition", () => {
  const clock = new BossClock();
  clock.update(0, { lastRoomEntered: true });
  assert.equal(clock.update(10), true);
});
test("boss arrival preserves prepared group and all ledger balances", () => {
  const s = new RefugeSimulation({ autoAdvance: false });
  s.charges = 0;
  const before = s.manager.snapshot();
  s.spawnLeader("a", "Veyra");
  assert.deepEqual(s.manager.snapshot(), before);
  assert.equal(s.actors.at(-1).hp, 550);
  assert.equal(s.actors.at(-1).cost, 20);
  assert.ok(s.exportJournalLog().includes("Scripted leader arrived"));
});
test("slow rolling first lieutenant chamber eventually brings its boss there", () => {
  const s = new RefugeSimulation({
    autoAdvance: false,
    power: 72,
    playerStats: { maxHp: 200, regen: 3, maxPotions: 3 },
  });
  s.enter("a", 0, "Test first chamber");
  for (
    let i = 0;
    i < 16000 && !s.zone.currentZone.bossClock.spawned && !s.failed;
    i++
  )
    s.tick(0.05);
  assert.equal(s.failed, false);
  assert.equal(s.area, "a");
  assert.equal(s.sub, 0);
  assert.ok(s.zone.currentZone.bossClock.spawned);
  assert.ok(s.sweepComplete);
  s.manager.verify();
});
const opposition = () => ({
  id: 9000,
  cost: 1,
  hp: 10000,
  maxHp: 10000,
  tags: [],
  tier: "normal",
  age: 0,
  position: { x: 0.5, y: 0.5 },
});
function lieutenant() {
  const s = new RefugeSimulation({ autoAdvance: false });
  s.enter("a", 0, "Test zone entry");
  s.charges = 0;
  return s;
}
function exhaustBudget(s) {
  const m = new EncounterManager({
    config: fixture,
    runtime: { budgetAwareComposition: true },
  });
  m.updatePortals([{ id: "front", eligible: true, tags: ["forward"] }]);
  m.addPotential(2, "fixture");
  m.transfer(2);
  m.tick(0, adapter);
  assert.ok(m.budgetComplete);
  assert.equal(m.next, null);
  s.manager = m;
}
test("last-room entry only releases its normal portion, preserves N+1 and starts a delayed boss", () => {
  const s = lieutenant();
  s.actors = [opposition()];
  const before = s.manager.snapshot(),
    plan = s.next;
  s.enter("a", 3, "Test last-room entry");
  assert.equal(s.current().released, 25);
  assert.equal(s.potential, before.potential - 25);
  assert.equal(s.available, before.available + 25);
  assert.equal(s.spent, before.spent);
  assert.equal(s.added, before.introduced);
  assert.equal(s.next, plan);
  assert.equal(s.draining, false);
  assert.equal(
    s.actors.some((a) => a.key === "a"),
    false,
  );
  assert.equal(s.zone.currentZone.bossClock.deadline, 10);
});
test("host does not treat an empty field with a pending group as zone completion", () => {
  const s = lieutenant();
  assert.ok(s.next);
  assert.equal(s.actors.length, 0);
  s.updateBoss();
  assert.equal(s.zone.currentZone.bossClock.deadline, null);
});
test("exhausted funding alone does not start the short timer with opposition alive", () => {
  const s = lieutenant();
  exhaustBudget(s);
  s.actors = [opposition()];
  s.updateBoss();
  assert.equal(s.zone.currentZone.bossClock.deadline, null);
  s.hit(s.actors[0], 10000);
  s.updateBoss();
  assert.equal(s.zone.currentZone.bossClock.mode, "short");
  assert.equal(s.zone.currentZone.bossClock.deadline, 6);
});
test("host subtracts the long-short delta and spawns immediately when overdue", () => {
  const s = lieutenant();
  s.actors = [opposition()];
  s.enter("a", 3, "Last room");
  assert.equal(s.zone.currentZone.bossClock.deadline, 10);
  exhaustBudget(s);
  s.actors = [];
  s.t = 8;
  const before = s.manager.snapshot();
  s.updateBoss();
  assert.equal(s.zone.currentZone.bossClock.deadline, 6);
  assert.equal(s.actors.filter((a) => a.key === "a").length, 1);
  assert.deepEqual(s.manager.snapshot(), before);
  s.updateBoss();
  assert.equal(s.actors.filter((a) => a.key === "a").length, 1);
});
test("host long timer brings a boss while funded future groups and opposition remain", () => {
  const s = lieutenant();
  s.actors = [opposition()];
  s.enter("a", 3, "Last room");
  s.t = 9.95;
  s.updateBoss();
  assert.equal(s.actors.length, 1);
  const before = s.manager.snapshot();
  s.t = 10;
  s.updateBoss();
  assert.equal(s.actors.length, 2);
  assert.deepEqual(s.manager.snapshot(), before);
});
test("restart resets boss deadlines and preserves selected timing configuration", () => {
  const s = new RefugeSimulation({
    autoAdvance: false,
    bossTiming: { longSeconds: 12, shortSeconds: 3 },
  });
  s.enter("a", 0, "Zone");
  s.actors = [opposition()];
  s.enter("a", 3, "Last room");
  assert.equal(s.zone.currentZone.bossClock.deadline, 12);
  s.restart();
  for (const z of s.zone.zones) {
    assert.equal(z.bossClock.deadline, null);
    assert.equal(z.bossClock.spawned, false);
    assert.equal(z.bossClock.longSeconds, 12);
    assert.equal(z.bossClock.shortSeconds, 3);
  }
});
test("entry zone never schedules a scripted lieutenant even when exhausted", () => {
  const s = new RefugeSimulation({ autoAdvance: false });
  exhaustBudget(s);
  s.actors = [];
  s.t = 100;
  s.updateBoss();
  assert.equal(s.zone.currentZone.bossClock.deadline, null);
  assert.equal(s.actors.length, 0);
});
console.log(`${checks} final-budget, target and boss-countdown checks passed.`);
