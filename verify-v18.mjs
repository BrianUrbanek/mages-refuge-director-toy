import assert from "node:assert/strict";
import { SceneTimeline } from "./dist/display/scene-timeline.mjs";
import { RefugeSimulation } from "./dist/game/refuge-simulation.mjs";
import { EncounterManager } from "./dist/core/encounter-manager.mjs";
import { fixture } from "./core-fixture.mjs";
let checks = 0;
const test = (name, fn) => {
  fn();
  checks++;
  console.log("PASS " + name);
};
const room = (id, zoneId = "a") => ({
  roomId: `${zoneId}:${id}`,
  zoneId,
  roomName: "Room " + id,
  zoneName: "Floor " + zoneId,
});
test("display travel and mutation of scene metadata cannot change simulation", () => {
  const sim = new RefugeSimulation({ autoAdvance: false }),
    motion = new SceneTimeline();
  const scene = sim.sceneSnapshot(),
    before = sim.exportTrace();
  motion.update(scene, 0);
  scene.location.roomName = "Changed";
  motion.update({ ...scene, location: room(1) }, 2);
  assert.deepEqual(sim.exportTrace(), before);
});
const adapter = {
  assetsReady: () => true,
  canEnter: () => true,
  commitSpawn: (g) => ({
    success: true,
    actorIds: g.members.map((_, i) => `unit-${i}`),
  }),
};
function beforeWarning() {
  const sim = new RefugeSimulation({ autoAdvance: false });
  const manager = new EncounterManager({
    config: { ...fixture, flowRate: 0.5 },
    runtime: { budgetAwareComposition: true, warningLeadSeconds: 6 },
  });
  manager.addPotential(100, "zone:entry");
  manager.transfer(4);
  manager.updatePortals(sim.zone.descriptors());
  manager.tick(0, adapter);
  sim.manager = manager;
  return sim;
}
test("Steady can advance outside the six-second forecast window but waits at its boundary", () => {
  const s = beforeWarning();
  assert.equal(s.manager.fundingEta(), 8);
  assert.equal(s.dispatch, null);
  assert.equal(s.approachReady(), true);
  s.manager.transfer(1);
  s.manager.tick(0, adapter);
  assert.equal(s.manager.fundingEta(), 6);
  assert.ok(s.dispatch);
  assert.equal(s.approachReady(), false);
});
test("room entry outside a warning can fund two legitimate groups with only engine recovery", () => {
  const s = beforeWarning();
  assert.equal(s.advance(), true);
  assert.equal(s.available, 29);
  s.tick(0.05);
  assert.equal(s.spent, 8);
  assert.ok(s.available >= s.next.cost);
  s.tick(1);
  assert.equal(s.journal.spawnedGroups, 2);
  s.manager.verify();
});
console.log(`${checks} travel display and warning-boundary checks passed.`);
