import assert from "node:assert/strict";
import { RefugeSimulation } from "./dist/game/refuge-simulation.mjs";
import { CombatModel } from "./dist/game/combat-model.mjs";
import {
  DEFAULT_PLAYER_STATS,
  PLAYER_STAT_OPTIONS,
  resolvePlayerStats,
} from "./dist/game/player-stats.mjs";
import { timelineGeometry } from "./dist/display/timeline.mjs";
let checks = 0;
const test = (n, f) => {
  f();
  checks++;
  console.log("PASS " + n);
};
const actor = (id, cost = 1, leader = false) => ({
  id,
  cost,
  leader,
  hp: 9999,
  maxHp: 9999,
  tags: ["melee"],
  tier: "normal",
  position: { x: 0.5, y: 0.5 },
  age: 0,
});
const kill = (c, id, cost, leader = false) => {
  const a = actor(id, cost, leader);
  c.actors.push(a);
  c.hit(a, 9999);
};
test("all offered steps create full valid resources", () => {
  for (const o of PLAYER_STAT_OPTIONS)
    for (const value of o.steps) {
      const s = new RefugeSimulation({ playerStats: { [o.key]: value } });
      assert.equal(s.playerStats[o.key], value);
      assert.equal(s.hp, s.playerStats.maxHp);
      assert.equal(s.charges, s.playerStats.maxCharges);
      assert.equal(s.combat.potions, s.playerStats.maxPotions);
    }
});
test("invalid settings reject before replacing current run", () => {
  const s = new RefugeSimulation();
  s.tick(1);
  const before = s.snapshot();
  for (const bad of [
    { maxHp: 0 },
    { regen: NaN },
    { power: Infinity },
    { maxCharges: 1.5 },
    { maxPotions: -1 },
  ]) {
    assert.throws(() => s.restartAtDepth(1, false, bad));
    assert.deepEqual(s.snapshot(), before);
  }
});
test("restart with stats resets resources and retains approach and route", () => {
  const s = new RefugeSimulation({ approach: "press", route: "full" });
  s.tick(1);
  s.restartAtDepth(1, false, {
    maxHp: 200,
    maxCharges: 4,
    maxPotions: 3,
    power: 72,
    regen: 3,
  });
  assert.equal(s.t, 0);
  assert.equal(s.hp, 200);
  assert.equal(s.charges, 4);
  assert.equal(s.combat.potions, 3);
  assert.equal(s.approach, "press");
  assert.equal(s.route, "full");
  assert.equal(s.spent, 0);
});
test("ordinary reset retains applied stats", () => {
  const s = new RefugeSimulation({
    playerStats: { maxHp: 150, maxCharges: 3 },
  });
  s.tick(2);
  s.restart();
  assert.equal(s.hp, 150);
  assert.equal(s.charges, 3);
  assert.equal(s.playerStats.maxHp, 150);
});
test("Sanctum restart preserves activity and custom stats", () => {
  const s = new RefugeSimulation();
  s.reset(true);
  s.restartAtDepth(1, true, { maxPotions: 3 });
  assert.equal(s.sanctum, true);
  assert.equal(s.combat.potions, 3);
  assert.equal(s.earned, 0);
});
test("Steady uses 70 percent HP with two charges at scaled health", () => {
  const s = new RefugeSimulation({
    playerStats: { maxHp: 200, maxCharges: 4 },
  });
  s.actors = [];
  s.hp = 139.99;
  assert.equal(s.approachReady(), false);
  s.hp = 140;
  s.charges = 1;
  assert.equal(s.approachReady(), false);
  s.charges = 2;
  assert.equal(s.approachReady(), true);
});
test("Press ignores selected reserves after clearing", () => {
  const s = new RefugeSimulation({
    approach: "press",
    playerStats: { maxHp: 200, maxCharges: 4 },
  });
  s.actors = [];
  s.hp = 1;
  s.charges = 0;
  assert.equal(s.approachReady(), true);
  s.actors = [actor(1)];
  assert.equal(s.approachReady(), false);
});
test("base damage remains source of burst damage", () => {
  for (const power of [24, 36, 48, 60, 72]) {
    const c = new CombatModel({ stats: { power } });
    c.actors = [actor(1, 20)];
    c.pulse();
    assert.equal(9999 - c.actors[0].hp, power * 0.5 * 4);
  }
});
test("regen scales quiet recovery but does not change the health-based reserve rule", () => {
  const c = new CombatModel({ stats: { regen: 3 } });
  c.hp = 60;
  c.step(1, 1);
  assert.equal(c.hp, 75);
  c.charges = 1;
  c.actors = [actor(1, 30)];
  c.pulse();
  assert.equal(c.charges, 1);
  c.hp = 50;
  c.actors = [actor(1, 37.5)];
  c.pulse();
  assert.equal(c.charges, 0);
});
test("charge refill caps at selected count without hidden reserve", () => {
  const c = new CombatModel({ stats: { maxCharges: 4 } });
  c.charges = 0;
  c.refillCharges(39.9);
  assert.equal(c.charges, 3);
  c.refillCharges(0.1);
  assert.equal(c.charges, 4);
  c.refillCharges(100);
  assert.equal(c.chargeProgress, 0);
});
test("potions use percentage threshold but fixed 40 healing", () => {
  const c = new CombatModel({ stats: { maxHp: 200, maxPotions: 3 } });
  c.hp = 100;
  assert.equal(c.usePotion(), false);
  c.hp = 99;
  assert.equal(c.usePotion(), true);
  assert.equal(c.hp, 139);
  assert.equal(c.potions, 2);
});
test("low HP can automatically consume multiple available potions", () => {
  const c = new CombatModel({ stats: { maxHp: 200, maxPotions: 3 } });
  c.hp = 10;
  c.usePotion();
  assert.equal(c.hp, 130);
  assert.equal(c.potions, 0);
  assert.equal(c.potionsUsed, 3);
});
test("small health pool clips actual potion healing", () => {
  const c = new CombatModel({ stats: { maxHp: 75 } });
  c.hp = 37;
  c.usePotion();
  assert.equal(c.hp, 75);
  assert.equal(c.potionHealing, 38);
});
test("30 killed fuel refills one missing slot", () => {
  const c = new CombatModel({ stats: { maxPotions: 3 } });
  c.potions = 0;
  kill(c, 1, 30);
  assert.equal(c.potions, 1);
  assert.equal(c.potionKillRefills, 1);
  kill(c, 2, 15);
  assert.equal(c.potionProgress, 15);
  c.hp = 49;
  c.usePotion();
  assert.equal(c.potionProgress, 15);
  kill(c, 3, 15);
  assert.equal(c.potions, 1);
});
test("leader refills all missing slots and resets partial progress", () => {
  const c = new CombatModel({ stats: { maxPotions: 3 } });
  c.potions = 1;
  c.potionProgress = 20;
  kill(c, 1, 4, true);
  assert.equal(c.potions, 3);
  assert.equal(c.potionProgress, 0);
  assert.equal(c.potionLeaderRefills, 1);
  assert.equal(c.potionKillRefills, 0);
});
test("multiple refill thresholds cannot exceed capacity or bank surplus", () => {
  const c = new CombatModel({ stats: { maxPotions: 3 } });
  c.potions = 0;
  kill(c, 1, 100);
  assert.equal(c.potions, 3);
  assert.equal(c.potionKillRefills, 3);
  assert.equal(c.potionProgress, 0);
});
test("applied tuning appears in detached views results and journal export", () => {
  const s = new RefugeSimulation({ playerStats: { maxHp: 150, power: 48 } });
  const trace = s.exportTrace();
  assert.equal(trace.settings.playerStats.maxHp, 150);
  assert.equal(trace.results.playerStats.power, 48);
  assert.ok(
    trace.journal.entries.some(
      (e) => e.kind === "player-settings" && e.data.maxHp === 150,
    ),
  );
  const v = s.viewState();
  v.playerStats.power = 999;
  assert.equal(s.power, 48);
});
test("timeline health scale follows selected maximum", () => {
  const g = timelineGeometry(
    [
      { time: 0, health: 200, points: 0 },
      { time: 1, health: 100, points: 0 },
    ],
    [],
    200,
  );
  assert.equal(g.health, "M 0.00 15.00 L 600.00 52.50");
});
test("chest remains once per run and introduces its declared fuel", () => {
  const s = new RefugeSimulation();
  const added = s.added;
  s.chest();
  assert.equal(s.added, added + 24);
  assert.equal(s.viewState().chestApplied, true);
  s.chest();
  assert.equal(s.added, added + 24);
});
test("higher damage improves isolated clear without changing Director budget", () => {
  const times = [];
  for (const power of [36, 72]) {
    const s = new RefugeSimulation({
      autoAdvance: false,
      playerStats: { power },
    });
    s.manager.end();
    s.actors = [actor(1, 20)];
    s.actors[0].hp = 440;
    while (s.actors.length && s.t < 30) s.tick(0.05);
    assert.equal(s.added, 100);
    times.push(s.t);
  }
  assert.ok(times[1] < times[0]);
});
console.log(`${checks} stepped player-power checks passed.`);
