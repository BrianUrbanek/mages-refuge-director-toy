import assert from "node:assert/strict";
import { CombatModel } from "./dist/game/combat-model.mjs";
import { RefugeSimulation } from "./dist/game/refuge-simulation.mjs";
let checks = 0;
const test = (name, fn) => {
  fn();
  checks++;
  console.log("PASS " + name);
};
const actor = (id = 1, cost = 1) => ({
  id,
  cost,
  hp: 9999,
  maxHp: 9999,
  tags: ["melee"],
  tier: "normal",
  position: { x: 0.5, y: 0.5 },
  age: 0,
  leader: false,
});
function quiet(approach = "press") {
  const s = new RefugeSimulation({ approach });
  s.manager.end();
  s.actors = [];
  return s;
}
test("four quiet seconds recover 60 to 80 HP", () => {
  const c = new CombatModel();
  c.hp = 60;
  c.step(4, 4);
  assert.equal(c.hp, 80);
  assert.equal(c.effectiveRegen(), 5);
});
test("any living enemy restores base regen including supports", () => {
  const c = new CombatModel();
  c.hp = 60;
  c.pressurePerPoint = 0;
  c.actors = [{ ...actor(), tags: ["support"] }];
  c.step(1, 1);
  assert.equal(c.hp, 61);
  assert.equal(c.effectiveRegen(), 1);
});
test("quiet recovery scales base regen and clamps maximum", () => {
  const c = new CombatModel();
  c.regen = 2;
  c.hp = 99;
  c.step(1, 1);
  assert.equal(c.hp, 100);
  assert.equal(c.effectiveRegen(), 10);
});
test("clear switches recovery and new arrivals switch it back", () => {
  const c = new CombatModel();
  c.hp = 50;
  c.pressurePerPoint = 0;
  c.actors = [actor()];
  c.step(0.05, 0.05);
  c.defeat(c.actors[0]);
  c.step(0.1, 0.05);
  assert.ok(Math.abs(c.hp - 50.3) < 1e-8);
  c.actors = [actor(2)];
  c.step(0.15, 0.05);
  assert.ok(Math.abs(c.hp - 50.35) < 1e-8);
});
test("resting does not bank extra charges and the lone charge waits for half health", () => {
  const c = new CombatModel();
  c.charges = 0;
  c.step(20, 20);
  assert.equal(c.charges, 2);
  assert.equal(c.chargeProgress, 0);
  c.charges = 1;
  c.actors = [actor(1, 12)];
  c.pulse();
  assert.equal(c.charges, 1);
  c.hp = 50;
  c.actors = [actor(1, 12.5)];
  const before = c.actors[0].hp;
  c.pulse();
  assert.equal(c.charges, 0);
  assert.equal(before - c.actors[0].hp, 72);
});
test("both clearing approaches wait for all overlapping defenders", () => {
  for (const approach of ["steady", "press"]) {
    const s = quiet(approach);
    s.actors = [actor(1), actor(2)];
    assert.equal(s.approachReady(), false);
    s.actors.pop();
    assert.equal(s.approachReady(), false);
    s.actors = [];
    assert.equal(s.approachReady(), true);
  }
});
test("press advances on first empty step without health charge or dwell gates", () => {
  const s = quiet();
  s.hp = 5;
  s.charges = 0;
  s.tick(0.05);
  assert.equal(s.sub, 1);
  assert.ok(s.t < 0.1);
});
test("steady recovers to 70 with two charges then advances", () => {
  const s = quiet("steady");
  s.hp = 60;
  s.tick(1.95);
  assert.equal(s.sub, 0);
  s.tick(0.05);
  assert.equal(s.sub, 1);
  assert.ok(s.hp >= 70 - 1e-7);
});
test("steady can leave at full health with one charge", () => {
  const s = quiet("steady");
  s.hp = 80;
  s.charges = 1;
  s.tick(3.95);
  assert.equal(s.sub, 0);
  s.tick(0.1);
  assert.ok(s.sub >= 1);
  assert.equal(s.charges, 1);
});
test("holding still funds the Director and recovers health and charges", () => {
  const s = new RefugeSimulation({ approach: "press" });
  s.hold = true;
  s.hp = 60;
  s.charges = 0;
  const potential = s.potential;
  s.tick(1);
  assert.equal(s.sub, 0);
  assert.ok(s.potential < potential);
  assert.ok(s.chargeProgress > 0);
});
test("required lieutenant checkpoint still blocks empty-field advance", () => {
  const s = quiet();
  s.enter("a", 3, "Test checkpoint");
  s.actors = [];
  s.tick(0.05);
  assert.equal(s.area, "a");
  assert.equal(s.sub, 3);
  assert.equal(s.gateReady(), false);
});
test("charge retains two-second dwell and may advance with enemies alive", () => {
  const s = quiet("charge");
  s.actors = [actor()];
  s.tick(1.95);
  assert.equal(s.sub, 0);
  s.tick(0.1);
  assert.equal(s.sub, 1);
  assert.ok(s.actors.length > 0);
});
test("read model exposes current regen without presentation owning mechanics", () => {
  const s = quiet();
  assert.equal(s.viewState().regeneration, 5);
  s.actors = [actor()];
  assert.equal(s.viewState().regeneration, 1);
});
console.log(`${checks} approach and quiet-recovery checks passed.`);
