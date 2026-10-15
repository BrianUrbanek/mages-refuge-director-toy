import assert from "node:assert/strict";
import { SceneTimeline } from "./dist/display/scene-timeline.mjs";
import {
  actorPosition,
  effectVisible,
} from "./dist/display/actor-geometry.mjs";
import { CrowdView } from "./dist/display/crowd-view.mjs";
import { RefugeSimulation } from "./dist/game/refuge-simulation.mjs";
let checks = 0;
const test = (name, fn) => {
  fn();
  checks++;
  console.log("PASS " + name);
};
const scene = (room, time = 0, actors = [], departure = null) => ({
  location: { roomId: room, zoneId: room[0], roomName: room },
  time,
  actors,
  effects: [],
  arena: { room, actors },
  departure,
});
test("new room actors and doors are withheld throughout the front-gate exit", () => {
  const t = new SceneTimeline(),
    old = scene("a0"),
    next = scene("a1", 1, [{ id: 1 }], old);
  t.update(old, 0);
  let p = t.update(next, 0);
  assert.equal(p.phase, "exiting");
  assert.equal(p.scene, old);
  p = t.update(next, 0.55);
  assert.equal(p.phase, "hidden");
  assert.equal(p.scene.arena.room, "a0");
  p = t.update(next, 0.12);
  assert.equal(p.phase, "entering");
  assert.equal(p.scene.location.roomId, "a1");
  assert.equal(p.scene.actors.length, 1);
  assert.equal(p.traveler.x, 0.14);
});
test("exit uses the exact cleared departure, not an earlier frame with enemies", () => {
  const t = new SceneTimeline(),
    old = scene("a0", 0, [{ id: 7 }]),
    cleared = scene("a0", 1),
    next = scene("a1", 1, [{ id: 8 }], cleared);
  t.update(old, 0);
  const p = t.update(next, 0.05);
  assert.equal(p.phase, "exiting");
  assert.equal(p.scene, cleared);
  assert.equal(p.scene.actors.length, 0);
});
test("early arrival and burst snapshots replay rather than getting replaced by latest state", () => {
  const t = new SceneTimeline(),
    old = scene("a0"),
    birth = scene("a1", 1, [], old);
  birth.effects = [
    { type: "death", time: 1 },
    { type: "burst", time: 1 },
  ];
  t.update(old, 0);
  t.update(birth, 0.05);
  const later = scene("a1", 1.5, [], old);
  t.update(later, 0.5);
  const p = t.update(later, 0.17);
  assert.equal(p.scene, birth);
  assert.equal(p.scene.effects.length, 2);
});
test("paused travel drains in presentation time without advancing combat time", () => {
  const t = new SceneTimeline(),
    a = scene("a0", 5),
    b = scene("a1", 5, [], a);
  t.update(a, 0);
  t.update(b, 0);
  const p = t.update(b, 1.32);
  assert.equal(p.phase, "idle");
  assert.equal(p.scene.time, 5);
  assert.equal(p.traveler.x, 0.5);
});
test("rapid room entries retain intermediate scene order", () => {
  const t = new SceneTimeline(),
    a = scene("a0"),
    b = scene("a1", 1, [], a),
    c = scene("b0", 2, [], b);
  t.update(a, 0);
  t.update(b, 0.1);
  t.update(c, 0.1);
  const p = t.update(c, 0.57);
  assert.equal(p.location.roomId, "a1");
  assert.equal(t.update(c, 0.1).location.roomId, "b0");
});
test("reduced motion snaps all arena layers together and does not rewind when disabled", () => {
  const t = new SceneTimeline(),
    a = scene("a0"),
    b = scene("b0", 1, [], a);
  t.update(a, 0);
  const p = t.update(b, 0.1, { reducedMotion: true });
  assert.equal(p.phase, "idle");
  assert.equal(p.location.roomId, "b0");
  assert.equal(t.update(b, 0.1).location.roomId, "b0");
});
test("reset drops old scenes, effects and travel", () => {
  const t = new SceneTimeline();
  t.update(scene("a0"), 0);
  t.update(scene("a1"), 0.1);
  t.reset();
  const p = t.update(scene("x0"), 0);
  assert.equal(p.phase, "idle");
  assert.equal(p.location.roomId, "x0");
});
test("geometry clamps arrival interpolation and effects cannot appear before their event", () => {
  const a = { spawnPoint: { x: 0, y: 1 }, position: { x: 1, y: 0 }, age: -1 };
  assert.deepEqual(actorPosition(a), a.spawnPoint);
  a.age = 0.3;
  assert.deepEqual(actorPosition(a), { x: 0.5, y: 0.5 });
  a.age = 2;
  assert.deepEqual(actorPosition(a), a.position);
  assert.equal(effectVisible({ time: 2 }, 1, 0.8), false);
  assert.equal(effectVisible({ time: 2 }, 2, 0.8), true);
});
test("visible beam endpoints match arrival blocks and spill chains", () => {
  globalThis.window = { devicePixelRatio: 1 };
  const moves = [],
    lines = [];
  const ctx = new Proxy(
    {
      moveTo: (x, y) => moves.push([x, y]),
      lineTo: (x, y) => lines.push([x, y]),
    },
    { get: (o, k) => o[k] ?? (() => {}) },
  );
  const canvas = {
    getContext: () => ctx,
    getBoundingClientRect: () => ({ width: 100, height: 100 }),
  };
  const view = new CrowdView(canvas, () => {}),
    actor = (id, x) => ({
      id,
      cost: 1,
      age: 0,
      position: { x: 0.5, y: 0.5 },
      spawnPoint: { x, y: 0.2 },
      tags: [],
      tier: "normal",
      hp: 10,
      maxHp: 10,
    });
  view.render(
    {
      time: 1,
      actors: [actor(1, 0.1), actor(2, 0.9)],
      effects: [
        {
          type: "attack",
          time: 1,
          actorId: 1,
          from: { x: 0.5, y: 0.57 },
          to: { x: 0.5, y: 0.5 },
        },
        {
          type: "attack",
          time: 1,
          actorId: 2,
          fromActorId: 1,
          from: { x: 0.5, y: 0.5 },
          to: { x: 0.5, y: 0.5 },
        },
      ],
    },
    0,
  );
  assert.deepEqual(lines, [
    [10, 20],
    [90, 20],
  ]);
  assert.deepEqual(
    moves.map((p) => p.map(Math.round)),
    [
      [50, 57],
      [10, 20],
    ],
  );
  delete globalThis.window;
});
test("arrival-pulse kills have death markers even before their first rendered frame", () => {
  globalThis.window = { devicePixelRatio: 1 };
  const ctx = new Proxy({}, { get: () => () => {} });
  const view = new CrowdView(
    {
      getContext: () => ctx,
      getBoundingClientRect: () => ({ width: 100, height: 100 }),
    },
    () => {},
  );
  const actor = {
    id: 3,
    cost: 2,
    age: 0,
    position: { x: 0.5, y: 0.5 },
    spawnPoint: { x: 0.1, y: 0.2 },
  };
  view.render(
    { time: 1, actors: [], effects: [{ type: "death", time: 1, actor }] },
    0,
  );
  assert.equal(view.ghosts.length, 1);
  assert.deepEqual(view.ghosts[0].position, actor.spawnPoint);
  view.render(
    { time: 1, actors: [], effects: [{ type: "death", time: 1, actor }] },
    0,
  );
  assert.equal(view.ghosts.length, 1);
  delete globalThis.window;
});
test("departure/read models are detached and presentation never changes host decisions", () => {
  const sim = new RefugeSimulation({ autoAdvance: false }),
    t = new SceneTimeline();
  t.update(sim.sceneSnapshot(), 0);
  sim.effect("burst");
  sim.advance();
  const s = sim.sceneSnapshot(),
    trace = sim.exportTrace();
  assert.notEqual(s.departure.location.roomId, s.location.roomId);
  assert.ok(s.departure.effects.some((e) => e.type === "burst"));
  assert.ok(!s.effects.some((e) => e.type === "burst"));
  assert.ok(!s.arena.effects.some((e) => e.type === "burst"));
  t.update(s, 0.3);
  t.update(s, 1);
  s.departure.arena.current.name = "changed";
  assert.deepEqual(sim.exportTrace(), trace);
  assert.notEqual(sim.sceneSnapshot().departure.arena.current.name, "changed");
});
test("real combat/death/leader effects render through a full seeded run without changing its outcome", () => {
  globalThis.window = { devicePixelRatio: 1 };
  const ctx = new Proxy(
    { createRadialGradient: () => ({ addColorStop: () => {} }) },
    { get: (o, k) => o[k] ?? (() => {}) },
  );
  const view = new CrowdView(
    {
      getContext: () => ctx,
      getBoundingClientRect: () => ({ width: 100, height: 100 }),
    },
    () => {},
  );
  const sim = new RefugeSimulation(),
    control = new RefugeSimulation(),
    timeline = new SceneTimeline();
  for (let i = 0; i < 5000 && !sim.isTerminal(); i++) {
    sim.tick(0.1);
    control.tick(0.1);
    const p = timeline.update(sim.sceneSnapshot(), 0.1);
    view.render(p.scene, 0.1, p);
  }
  assert.ok(sim.isTerminal());
  assert.deepEqual(sim.runMetrics(), control.runMetrics());
  assert.ok(sim.kills > 0);
  delete globalThis.window;
});
console.log(`${checks} coherent arena checks passed`);
