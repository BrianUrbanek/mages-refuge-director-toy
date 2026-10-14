import assert from "node:assert/strict";
import { RoomTransition } from "./dist/display/room-transition.mjs";
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
test("room motion reaches front gate, vanishes, re-enters rear and returns to center", () => {
  const motion = new RoomTransition();
  motion.update(room(0), 0);
  let state = motion.update(room(1), 0.55);
  assert.equal(state.phase, "hidden");
  assert.equal(state.traveler.opacity, 0);
  assert.equal(state.traveler.x, 0.86);
  state = motion.update(room(1), 0.12);
  assert.equal(state.phase, "entering");
  assert.ok(Math.abs(state.traveler.x - 0.14) < 1e-8);
  state = motion.update(room(1), 0.65);
  assert.equal(state.phase, "idle");
  assert.deepEqual(state.traveler, { x: 0.5, y: 0.57, opacity: 1 });
});
test("background location switches at rear re-entry rather than on exit", () => {
  const motion = new RoomTransition();
  motion.update(room(0), 0);
  let s = motion.update(room(0, "c"), 0.3);
  assert.equal(s.location.zoneId, "a");
  s = motion.update(room(0, "c"), 0.4);
  assert.equal(s.location.zoneId, "c");
  assert.ok(s.floorChanged);
});
test("reduced motion changes rooms immediately without hiding or moving the symbol", () => {
  const motion = new RoomTransition();
  motion.update(room(0), 0);
  const s = motion.update(room(1), 0, { reducedMotion: true });
  assert.equal(s.phase, "idle");
  assert.equal(s.location.roomId, "a:1");
  assert.deepEqual(s.traveler, { x: 0.5, y: 0.57, opacity: 1 });
});
test("rapid door requests coalesce to newest room without a stale animation queue", () => {
  const motion = new RoomTransition();
  motion.update(room(0), 0);
  motion.update(room(1), 0.2);
  motion.update(room(2), 0.2);
  const s = motion.update(room(3, "c"), 1);
  assert.equal(s.location.roomId, "c:3");
  assert.equal(s.phase, "idle");
});
test("reset removes any unfinished journey before a new run", () => {
  const motion = new RoomTransition();
  motion.update(room(0), 0);
  motion.update(room(1), 0.2);
  motion.reset();
  const s = motion.update(room(0, "entry"), 0);
  assert.equal(s.phase, "idle");
  assert.equal(s.location.zoneId, "entry");
  assert.equal(s.floorChanged, false);
});
test("display travel and mutation of scene metadata cannot change simulation", () => {
  const sim = new RefugeSimulation({ autoAdvance: false }),
    motion = new RoomTransition();
  const scene = sim.sceneSnapshot(),
    before = sim.exportTrace();
  motion.update(scene.location, 0);
  scene.location.roomName = "Changed";
  motion.update(room(1), 2);
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
