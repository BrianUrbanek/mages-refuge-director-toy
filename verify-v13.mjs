import assert from "node:assert/strict";
import { RefugeSimulation } from "./dist/game/refuge-simulation.mjs";
import { configFor, AREAS } from "./dist/demo-data.mjs";
let checks = 0;
const test = (n, f) => {
  f();
  checks++;
  console.log("PASS " + n);
};
test("personality lists are ten configurable cards with valid small breach recipes", () => {
  for (const a of AREAS)
    for (const id of ["balanced", "heavy", "swarm", "crescendo", "wave"]) {
      const c = configFor(a.menu, id);
      assert.equal(c.selection.cards.length, 10);
      for (const g of c.groups) {
        const total = g.members.reduce(
          (n, id) => n + c.enemies.find((e) => e.id === id).cost,
          0,
        );
        assert.ok(total >= 8 && total <= 10);
        assert.ok(g.standalone && g.tags.includes("breach"));
      }
    }
});
test("zone offers closed seals and room entry cannot open them", () => {
  const s = new RefugeSimulation({
    autoAdvance: false,
    selectionMode: "ordered",
  });
  const seals = s.entrances.filter((p) => p.breachable);
  assert.equal(seals.length, 2);
  assert.ok(seals.every((p) => !p.open));
  assert.ok(
    s.zone
      .descriptors()
      .filter((p) => p.breachable)
      .every((p) => p.eligible),
  );
  s.advance();
  s.advance();
  assert.ok(seals.every((p) => !p.open && p.breachable));
});
test("breach arrives through designated seal amid ongoing opposition and opens it once", () => {
  const s = new RefugeSimulation({
    autoAdvance: false,
    selectionMode: "ordered",
  });
  const c = s.manager.config;
  c.selection.cards = [
    { id: "normal", kind: "normal" },
    {
      id: "breach",
      kind: "breach",
      groupTags: ["breach"],
      portalTags: ["side-sealed"],
    },
    { id: "normal2", kind: "normal" },
  ];
  s.manager.updateConfig(c);
  s.invalidate();
  s.manager.transfer(20, "zone:entry");
  s.tick(0.05);
  const plan = s.next,
    portal = s.entrances.find((p) => p.id === plan.portalId);
  assert.equal(plan.intent, "breach");
  assert.ok(!portal.open);
  assert.ok(plan.cost >= 8 && plan.cost <= 10);
  const costBefore = s.livingCost();
  s.tick(1);
  assert.ok(portal.open && !portal.breachable);
  const event = s
    .exportTrace()
    .journal.entries.find(
      (e) => e.kind === "arrival" && e.data.group.intent === "breach",
    );
  assert.ok(event);
  assert.equal(event.data.entrance, portal.id);
  assert.ok(s.actors.some((a) => a.originPortal === portal.id));
  assert.ok(s.actors.some((a) => a.originPortal !== portal.id));
  assert.ok(s.livingCost() > 0 && costBefore > 0);
  assert.ok(!s.log.some((e) => e.text.includes("Passive funding forecast")));
  assert.ok(
    !s.manager.snapshot().portals.find((p) => p.id === portal.id).breachable,
  );
  s.manager.verify();
});
test("normal groups cannot accidentally open sealed doors", () => {
  const s = new RefugeSimulation({
    autoAdvance: false,
    selectionMode: "ordered",
  });
  s.tick(0.05);
  assert.ok(
    s.actors.every(
      (a) =>
        !a.originPortal.endsWith("/side") &&
        !a.originPortal.endsWith("/sealed"),
    ),
  );
  assert.ok(s.entrances.filter((p) => p.breachable).every((p) => !p.open));
});
test("manual disable cancels pending breach without changing seal state", () => {
  const s = new RefugeSimulation({ autoAdvance: false });
  assert.equal(s.next.intent, "breach");
  const p = s.entrances.find((p) => p.id === s.next.portalId);
  s.toggleEntrance(p.id);
  assert.equal(p.enabled, false);
  assert.equal(p.open, false);
  assert.equal(p.breachable, true);
  assert.equal(s.manager.next, null);
});
test("mode persists on restart and exports with selection decisions", () => {
  const s = new RefugeSimulation({ selectionMode: "ordered" });
  s.setSelectionMode("random");
  s.restart();
  assert.equal(s.selectionMode, "random");
  assert.equal(s.manager.config.selection.mode, "random");
  assert.equal(s.exportTrace().settings.selectionMode, "random");
  assert.ok(
    s.exportTrace().journal.entries.some((e) => e.data.type === "card-drawn"),
  );
});
test("identical seeds and commands reproduce selection and breaches", () => {
  const a = new RefugeSimulation({ autoAdvance: false, seed: 17 }),
    b = new RefugeSimulation({ autoAdvance: false, seed: 17 });
  a.tick(10);
  b.tick(10);
  assert.deepEqual(a.manager.snapshot(), b.manager.snapshot());
  assert.deepEqual(a.actors, b.actors);
});
test("each authored mode and personality reaches an honest terminal result", () => {
  for (const selectionMode of ["ordered", "random"])
    for (const personality of [
      "balanced",
      "heavy",
      "swarm",
      "crescendo",
      "wave",
    ]) {
      const s = new RefugeSimulation({ selectionMode, personality, power: 72 });
      for (let i = 0; i < 40000 && !s.isTerminal(); i++) s.tick(0.05);
      assert.ok(s.isTerminal(), selectionMode + "/" + personality);
      s.manager.verify();
      assert.equal(s.runMetrics().selectionMode, selectionMode);
    }
});
console.log(`${checks} deck and breach host checks passed.`);
