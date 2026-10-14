import assert from "node:assert/strict";
import { CombatModel } from "./dist/game/combat-model.mjs";
import { RefugeSimulation } from "./dist/game/refuge-simulation.mjs";
import { burstReason } from "./dist/game/player-policy.mjs";
let checks = 0;
const test = (name, fn) => {
  fn();
  checks++;
  console.log("PASS " + name);
};
const reserve = {
  charges: 1,
  maxCharges: 2,
  chargeProgress: 0,
  hp: 80,
  maxHp: 100,
  livingPoints: 10,
  priorityAlive: false,
};
const actor = (id, tags, hp = 200, cost = 1, x = 0.5) => ({
  id,
  tags,
  hp,
  maxHp: hp,
  cost,
  tier: "normal",
  age: 0,
  position: { x, y: 0.5 },
});
test("all strategies share surplus and imminent-recharge spending", () => {
  for (const strategy of ["health", "overwhelm", "priority"]) {
    assert.equal(
      burstReason({ ...reserve, strategy, charges: 2 }),
      "two-charges",
    );
    assert.equal(
      burstReason({ ...reserve, strategy, chargeProgress: 8 }),
      "recharge-imminent",
    );
    assert.equal(burstReason({ ...reserve, strategy }), null);
  }
});
test("only the selected conditional trigger can spend the last charge", () => {
  assert.equal(
    burstReason({ ...reserve, strategy: "health", hp: 50 }),
    "half-health",
  );
  assert.equal(
    burstReason({
      ...reserve,
      strategy: "overwhelm",
      hp: 10,
      livingPoints: 19.99,
    }),
    null,
  );
  assert.equal(
    burstReason({ ...reserve, strategy: "overwhelm", livingPoints: 20 }),
    "high-pressure",
  );
  assert.equal(
    burstReason({
      ...reserve,
      strategy: "priority",
      hp: 10,
      livingPoints: 100,
    }),
    null,
  );
  assert.equal(
    burstReason({ ...reserve, strategy: "priority", priorityAlive: true }),
    "priority-present",
  );
});
test("supports absorb ordinary and burst fire including selected-target overrides", () => {
  for (const charges of [0, 1]) {
    const c = new CombatModel({ burstStrategy: "priority" });
    c.charges = charges;
    c.actors = [actor(1, ["glass-cannon"]), actor(2, ["support"])];
    c.selected = 1;
    c.pulse();
    assert.equal(c.actors[0].hp, 200);
    assert.equal(c.actors[1].hp, 200 - (charges ? 72 : 18));
  }
});
test("spill continues through supports before other nearby enemies without losing damage", () => {
  const c = new CombatModel();
  c.charges = 0;
  c.actors = [
    actor(1, ["melee"], 200, 1, 0.5),
    actor(2, ["support"], 4, 1, 0.4),
    actor(3, ["support"], 4, 1, 0.9),
  ];
  c.pulse();
  assert.equal(c.kills, 2);
  assert.equal(c.actors[0].hp, 190);
});
test("priority presence changes timing without giving glass cannons special targeting", () => {
  const c = new CombatModel({ burstStrategy: "priority" });
  c.charges = 1;
  c.actors = [actor(1, ["bruiser"]), actor(2, ["glass-cannon"])];
  c.pulse();
  assert.equal(c.actors[0].hp, 128);
  assert.equal(c.actors[1].hp, 200);
  assert.equal(c.charges, 0);
});
test("changing strategy clears old emergency intent and survives restart", () => {
  const s = new RefugeSimulation();
  s.combat.emergencyBurstPending = true;
  assert.equal(s.setBurstStrategy("overwhelm"), true);
  assert.equal(s.combat.emergencyBurstPending, false);
  assert.equal(s.setBurstStrategy("overwhelm"), false);
  s.restart();
  assert.equal(s.burstStrategy, "overwhelm");
  assert.equal(s.combat.burstStrategy, "overwhelm");
  assert.throws(() => s.setBurstStrategy("unknown"));
  assert.equal(s.burstStrategy, "overwhelm");
});
test("strategy is visible in detached views results trace and causal Journal", () => {
  const s = new RefugeSimulation({ burstStrategy: "priority" });
  const v = s.viewState();
  v.burstStrategies.priority.name = "Changed";
  assert.notEqual(s.viewState().burstStrategies.priority.name, "Changed");
  assert.equal(s.runMetrics().burstStrategy, "priority");
  assert.equal(s.exportTrace().settings.burstStrategy, "priority");
  assert.match(s.exportJournalLog(), /priority charges/);
  assert.ok(s.journal.entries.some((e) => e.kind === "strategy"));
});
test("floor bosses use thirty-five equivalent and introduce or spend no Director fuel", () => {
  for (const key of ["a", "b1", "b2", "c", "boss", "liath"]) {
    const s = new RefugeSimulation({ autoAdvance: false });
    s.charges = 0;
    const before = s.manager.snapshot();
    s.spawnLeader(key, "Test floor boss");
    const a = s.actors[0];
    assert.equal(a.cost, 35);
    assert.equal(a.fuelEquivalent, 35);
    assert.equal(a.directorFuelCost, 0);
    assert.equal(a.hp, 770);
    assert.equal(s.incomingDps(), 8.4);
    assert.deepEqual(s.manager.snapshot(), before);
  }
});
test("linked guardians retain their small scripted equivalent", () => {
  const s = new RefugeSimulation({ autoAdvance: false });
  s.charges = 0;
  s.spawnLeader("guardian-test", "Guardian");
  assert.equal(s.actors[0].cost, 4);
});
console.log(
  `${checks} strategy, support-screen and scripted-budget checks passed.`,
);
