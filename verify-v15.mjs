import assert from "node:assert/strict";
import { CombatModel } from "./dist/game/combat-model.mjs";
import {
  burstReason,
  steadyReservesReady,
} from "./dist/game/player-policy.mjs";
import { RefugeSimulation } from "./dist/game/refuge-simulation.mjs";
let checks = 0;
const test = (name, fn) => {
  fn();
  checks++;
  console.log("PASS " + name);
};
const actor = (id = 1) => ({
  id,
  cost: 20,
  hp: 99999,
  maxHp: 99999,
  tags: ["melee"],
  tier: "normal",
  position: { x: 0.5, y: 0.5 },
  age: 0,
});
const reserve = {
  charges: 1,
  maxCharges: 2,
  chargeProgress: 0,
  hp: 100,
  maxHp: 100,
};
test("two charges spend immediately on arrival and restart pulse tempo", () => {
  const c = new CombatModel();
  c.actors = [actor()];
  c.attackProgress = 0.49;
  assert.equal(c.onArrival(), true);
  assert.equal(c.charges, 1);
  assert.equal(c.burstCount, 1);
  assert.equal(c.actors[0].hp, 99999 - 72);
  c.step(0.05, 0.05);
  assert.equal(c.burstCount, 1);
});
test("one charge stays reserved on arrival and during healthy combat", () => {
  const c = new CombatModel();
  c.actors = [actor()];
  c.charges = 1;
  assert.equal(c.onArrival(), false);
  c.pulse();
  assert.equal(c.charges, 1);
  assert.equal(c.actors[0].hp, 99999 - 18);
});
test("recharge imminent threshold is exactly two seconds", () => {
  assert.equal(burstReason({ ...reserve, chargeProgress: 7.99 }), null);
  assert.equal(
    burstReason({ ...reserve, chargeProgress: 8 }),
    "recharge-imminent",
  );
});
test("spending the last charge preserves ongoing refill progress", () => {
  const c = new CombatModel();
  c.actors = [actor()];
  c.charges = 1;
  c.chargeProgress = 8;
  c.pulse();
  assert.equal(c.charges, 0);
  assert.equal(c.chargeProgress, 8);
  c.refillCharges(2);
  assert.equal(c.charges, 1);
  assert.equal(c.chargeProgress, 0);
});
test("lone charge triggers at fifty percent of selected health", () => {
  for (const maxHp of [75, 100, 200]) {
    assert.equal(
      burstReason({ ...reserve, maxHp, hp: maxHp * 0.5 + 0.01 }),
      null,
    );
    assert.equal(
      burstReason({ ...reserve, maxHp, hp: maxHp * 0.5 }),
      "half-health",
    );
  }
});
test("a potion cannot mask the low-health trigger before the next pulse", () => {
  const c = new CombatModel();
  c.actors = [actor()];
  c.charges = 1;
  c.hp = 49;
  c.step(0.05, 0.05);
  assert.equal(c.potionsUsed, 1);
  assert.ok(c.hp > 50);
  c.step(0.5, 0.45);
  assert.equal(c.charges, 0);
  assert.equal(c.burstCount, 1);
  assert.equal(c.emergencyBurstPending, false);
});
test("single-charge capacity does not invent a second incoming charge", () => {
  assert.equal(
    burstReason({ ...reserve, maxCharges: 1, chargeProgress: 9 }),
    null,
  );
  assert.equal(
    burstReason({ ...reserve, maxCharges: 1, hp: 50 }),
    "half-health",
  );
  assert.equal(burstReason({ ...reserve, charges: 0, hp: 1 }), null);
});
test("higher capacities use surplus without retaining extra hidden reserves", () => {
  const c = new CombatModel({ stats: { maxCharges: 4 } });
  c.actors = [actor()];
  c.onArrival();
  c.pulse();
  c.pulse();
  c.pulse();
  assert.equal(c.burstCount, 3);
  assert.equal(c.charges, 1);
});
test("Steady accepts either seventy percent with two or full health with one", () => {
  const ready = (hp, charges, maxHp = 100) =>
    steadyReservesReady({ hp, charges, maxHp });
  assert.equal(ready(69.99, 2), false);
  assert.equal(ready(70, 2), true);
  assert.equal(ready(99.99, 1), false);
  assert.equal(ready(100, 1), true);
  assert.equal(ready(100, 0), false);
  assert.equal(ready(140, 2, 200), true);
  assert.equal(ready(200, 1, 200), true);
});
test("Steady still waits for living enemies and telegraphed waves", () => {
  const s = new RefugeSimulation();
  s.hp = 100;
  s.charges = 1;
  assert.equal(s.approachReady(), true);
  s.actors = [actor()];
  assert.equal(s.approachReady(), false);
  s.actors = [];
  s.manager.dispatch = { entrance: "entry/front" };
  assert.equal(s.approachReady(), false);
});
test("arrival burst is counted by the Journal even if it clears a scripted leader", () => {
  const s = new RefugeSimulation({ power: 72, autoAdvance: false });
  s.spawnLeader("guardian-test", "Test guardian");
  assert.equal(s.actors.length, 0);
  const summary = s.journal.entries.find((e) => e.kind === "combat-summary");
  assert.equal(summary.data.bursts, 1);
  assert.equal(summary.data.scriptedLeaders, 1);
  assert.equal(summary.data.defeats, 1);
  assert.equal(summary.data.fuel, 0);
});
test("host spawns spend once immediately and reset restores clean reserves", () => {
  const s = new RefugeSimulation({ autoAdvance: false });
  s.tick(0.05);
  assert.equal(s.burstCount, 1);
  assert.equal(s.charges, 1);
  assert.equal(s.journal.spawnedGroups, 1);
  s.restart();
  assert.equal(s.charges, 2);
  assert.equal(s.burstCount, 0);
  assert.equal(s.combat.emergencyBurstPending, false);
});
console.log(
  `${checks} charge-policy and alternative Steady-reserve checks passed.`,
);
