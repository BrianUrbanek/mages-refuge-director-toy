import assert from "node:assert/strict";
import { EncounterManager } from "./dist/core/encounter-manager.mjs";
import { BossClock } from "./dist/game/boss-clock.mjs";
import { CombatModel } from "./dist/game/combat-model.mjs";
import { RefugeSimulation } from "./dist/game/refuge-simulation.mjs";
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
console.log(`${checks} final-budget, target and boss-countdown checks passed.`);
