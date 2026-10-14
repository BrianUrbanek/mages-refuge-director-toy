import assert from "node:assert/strict";
import { CombatModel } from "./dist/game/combat-model.mjs";
import { RefugeSimulation } from "./dist/game/refuge-simulation.mjs";
let checks = 0;
const test = (name, fn) => {
  fn();
  checks++;
  console.log("PASS " + name);
};
const actor = (id, cost, leader = false) => ({
  id,
  cost,
  leader,
  hp: 9999,
  maxHp: 9999,
  tags: ["melee"],
  position: { x: 0.5, y: 0.5 },
  age: 0,
  tier: "normal",
});
function kill(c, id, cost, leader = false) {
  const a = actor(id, cost, leader);
  c.actors.push(a);
  c.hit(a, 9999);
}
test("starts with exactly one potion and zero progress", () => {
  const c = new CombatModel();
  assert.deepEqual(c.potionState(), { ready: true, count: 1, capacity: 1, progress: 0, required: 30 });
  assert.equal(c.potionsUsed, 0);
});
test("strictly below 50 heals 40 once without spending DPS charges", () => {
  const c = new CombatModel();
  c.hp = 50;
  assert.equal(c.usePotion(), false);
  c.hp = 49;
  assert.equal(c.usePotion(), true);
  assert.equal(c.hp, 89);
  assert.equal(c.charges, 2);
  assert.equal(c.potionsUsed, 1);
  assert.equal(c.potionHealing, 40);
  assert.equal(c.usePotion(), false);
});
test("damage crossing threshold triggers in same combat update", () => {
  const c = new CombatModel();
  c.hp = 50;
  c.actors = [actor(1, 20)];
  c.step(0.05, 0.05);
  assert.ok(Math.abs(c.hp - 89.81) < 1e-7);
  assert.equal(c.potionsUsed, 1);
});
test("empty potion neither heals nor resurrects", () => {
  const c = new CombatModel();
  c.potionReady = false;
  c.hp = 49;
  assert.equal(c.usePotion(), false);
  c.potionReady = true;
  c.hp = 0;
  assert.equal(c.usePotion(), false);
});
test("only defeated costs count; damage alone earns nothing", () => {
  const c = new CombatModel();
  c.potionReady = false;
  c.actors = [actor(1, 20)];
  c.hit(c.actors[0], 5);
  assert.equal(c.potionProgress, 0);
  kill(c, 2, 29.9);
  assert.equal(c.potionReady, false);
  assert.equal(c.potionProgress, 29.9);
  kill(c, 3, 0.1);
  assert.equal(c.potionReady, true);
  assert.equal(c.potionProgress, 0);
  assert.equal(c.potionKillRefills, 1);
});
test("full potion banks no progress or overflow", () => {
  const c = new CombatModel();
  kill(c, 1, 60);
  c.hp = 49;
  c.usePotion();
  assert.equal(c.potionProgress, 0);
  kill(c, 2, 61);
  assert.equal(c.potionKillRefills, 1);
  c.hp = 49;
  c.usePotion();
  assert.equal(c.potionProgress, 0);
  assert.equal(c.potionReady, false);
});
test("scripted leader replaces partial recharge with full potion", () => {
  const c = new CombatModel();
  c.potionReady = false;
  kill(c, 1, 12);
  kill(c, 2, 4, true);
  assert.equal(c.potionReady, true);
  assert.equal(c.potionProgress, 0);
  assert.equal(c.potionLeaderRefills, 1);
  assert.equal(c.potionKillRefills, 0);
});
test("leader refill while full creates no second potion", () => {
  const c = new CombatModel();
  kill(c, 1, 24, true);
  assert.equal(c.potionLeaderRefills, 0);
  c.hp = 49;
  c.usePotion();
  c.hp = 49;
  assert.equal(c.usePotion(), false);
});
test("low health consumes kill-earned refill immediately", () => {
  const c = new CombatModel();
  c.potionReady = false;
  c.hp = 20;
  kill(c, 1, 30);
  assert.equal(c.hp, 60);
  assert.equal(c.potionReady, false);
  assert.equal(c.potionProgress, 0);
  assert.equal(c.potionsUsed, 1);
});
test("low health consumes leader refill immediately", () => {
  const c = new CombatModel();
  c.potionReady = false;
  c.hp = 20;
  kill(c, 1, 18, true);
  assert.equal(c.hp, 60);
  assert.equal(c.potionLeaderRefills, 1);
  assert.equal(c.potionKillRefills, 0);
});
test("time and quiet regen do not recharge potions", () => {
  const c = new CombatModel();
  c.potionReady = false;
  c.potionProgress = 5;
  c.hp = 60;
  c.step(20, 20);
  assert.equal(c.hp, 100);
  assert.equal(c.potionProgress, 5);
  assert.equal(c.potionReady, false);
});
test("host leader refill changes no Director fuel and logs causal events", () => {
  const s = new RefugeSimulation({ autoAdvance: false });
  s.combat.potionReady = false;
  s.hp = 20;
  const fuel = () => {
    const f = s.manager.snapshot();
    return [f.potential, f.available, f.introduced, f.spent, f.fuelSources];
  };
  const before = fuel();
  s.spawnLeader("guardian-test", "Test guardian");
  s.hit(s.actors.at(-1), 9999);
  assert.deepEqual(fuel(), before);
  const entries = s
    .exportTrace()
    .journal.entries.filter((e) => e.kind === "potion");
  assert.deepEqual(
    entries.map((e) => e.data.type),
    ["potion-refilled", "potion-used"],
  );
  assert.equal(s.runMetrics().potionHealing, 40);
  assert.equal(s.runMetrics().potionLeaderRefills, 1);
});
test("reset restores potion and clears counters without altering preferences", () => {
  const s = new RefugeSimulation({ approach: "press" });
  s.hp = 49;
  s.combat.usePotion();
  s.restart();
  assert.equal(s.combat.potionReady, true);
  assert.equal(s.combat.potionsUsed, 0);
  assert.equal(s.combat.potionProgress, 0);
  assert.equal(s.approach, "press");
});
test("potion view state is detached", () => {
  const s = new RefugeSimulation();
  const v = s.viewState();
  v.potion.ready = false;
  v.potion.progress = 99;
  assert.equal(s.combat.potionReady, true);
  assert.equal(s.combat.potionProgress, 0);
});
const runs = [];
test("default required-route runs preserve strategy differences and honest results", () => {
  for (const approach of ["steady", "press", "charge"]) {
    const s = new RefugeSimulation({ approach });
    for (let i = 0; i < 40000 && !s.isTerminal(); i++) s.tick(0.05);
    assert.ok(s.isTerminal());
    s.manager.verify();
    const r = s.runMetrics();
    assert.equal(r.potionsUsed, s.combat.potionsUsed);
    assert.equal(r.potionHealing, s.combat.potionHealing);
    assert.ok(r.potionsUsed > 0);
    if (approach === "steady") assert.ok(s.victoryReady);
    else assert.ok(s.failed);
    runs.push({
      approach,
      outcome: r.outcome,
      seconds: s.t,
      potions: r.potionsUsed,
      healing: r.potionHealing,
      leaderRefills: r.potionLeaderRefills,
      health: s.hp,
    });
  }
});
console.log(JSON.stringify({ checks, runs }, null, 2));
