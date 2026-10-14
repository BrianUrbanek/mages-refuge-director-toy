import assert from "node:assert/strict";
import fs from "node:fs";
import { fixture } from "./core-fixture.mjs";
import {
  EncounterList,
  validateSelection,
} from "./dist/core/encounter-list.mjs";
import { compileEncounterOpportunities } from "./dist/core/encounter-opportunities.mjs";
import { composeStandalone } from "./dist/core/standalone-composer.mjs";
import { EncounterManager } from "./dist/core/encounter-manager.mjs";
let checks = 0;
const test = (n, f) => {
  f();
  checks++;
  console.log("PASS " + n);
};
const normal = (id, m = 1) => ({ id, kind: "normal", targetMultiplier: m });
const breach = {
  id: "breach",
  kind: "breach",
  groupTags: ["breach"],
  portalTags: ["side-sealed"],
};
const portals = [
  { id: "front", tags: ["forward"], eligible: true },
  { id: "seal", tags: ["side-sealed"], eligible: true, breachable: true },
];
const config = (
  cards = [normal("one"), breach, normal("two")],
  mode = "ordered",
  id = "test",
) => ({
  ...structuredClone(fixture),
  selection: { id, mode, cards },
  groups: [
    {
      id: "small",
      tags: ["breach"],
      standalone: true,
      members: ["guard", "guard", "guard", "guard"],
    },
  ],
});
const draw = (s, c, p = portals) => s.select(c, p).group;
function setup(c = config()) {
  let serial = 0;
  const adapter = {
    assetsReady: () => true,
    canEnter: () => true,
    commitSpawn: (p) => ({
      success: true,
      actorIds: p.members.map(() => ++serial),
    }),
  };
  const m = new EncounterManager({ config: c });
  m.updatePortals(portals);
  m.tick(0, adapter);
  return { m, adapter };
}
test("ordered list visits authored order then repeats", () => {
  const s = new EncounterList();
  const c = config([normal("a"), normal("b"), normal("c")]);
  assert.deepEqual(
    Array.from({ length: 6 }, () => draw(s, c).selection.cardId),
    ["a", "b", "c", "a", "b", "c"],
  );
});
test("random deck consumes each distinct card once per cycle", () => {
  const s = new EncounterList(9),
    c = config([normal("a"), normal("b"), normal("c"), normal("d")], "random");
  for (let cycle = 0; cycle < 3; cycle++)
    assert.equal(
      new Set(Array.from({ length: 4 }, () => draw(s, c).selection.cardId))
        .size,
      4,
    );
});
test("seeded draws reproduce card order", () => {
  const c = config([normal("a"), normal("b"), normal("c")], "random"),
    a = new EncounterList(17),
    b = new EncounterList(17);
  assert.deepEqual(
    Array.from({ length: 20 }, () => draw(a, c).selection.cardId),
    Array.from({ length: 20 }, () => draw(b, c).selection.cardId),
  );
});
test("list length is authored data, not hardcoded ten", () => {
  const s = new EncounterList(),
    c = config([normal("only")]);
  assert.equal(draw(s, c).selection.cycle, 1);
  assert.equal(draw(s, c).selection.cycle, 2);
});
test("duplicate instructions keep independent card identities", () => {
  const s = new EncounterList(),
    c = config([normal("a"), normal("b")]);
  assert.equal(draw(s, c).selection.cardId, "a");
  assert.equal(draw(s, c).selection.cardId, "b");
});
test("no breach portal excludes breach before draw", () => {
  const c = config(),
    s = new EncounterList();
  const result = s.select(c, [portals[0]]);
  assert.ok(
    result.events.some(
      (e) => e.type === "cards-filtered" && e.excluded.includes("breach"),
    ),
  );
  assert.equal(result.group.selection.cardId, "one");
  assert.equal(draw(s, c, [portals[0]]).selection.cardId, "two");
});
test("no matching group excludes breach despite portal keyword", () => {
  const c = config();
  c.groups = [];
  assert.ok(
    compileEncounterOpportunities(c.selection, c, portals).excluded.includes(
      "breach",
    ),
  );
});
test("group keywords cannot satisfy missing portal keywords", () => {
  const c = config();
  assert.ok(
    compileEncounterOpportunities(c.selection, c, [
      { ...portals[1], tags: [] },
    ]).excluded.includes("breach"),
  );
});
test("broken seal discards remaining breach card without reordering normals", () => {
  const c = config(),
    s = new EncounterList();
  draw(s, c);
  const p = [
    portals[0],
    { ...portals[1], breachable: false, tags: ["side-open"] },
  ];
  assert.equal(draw(s, c, p).selection.cardId, "two");
});
test("new cycle reconsiders newly available opportunities", () => {
  const c = config([breach]),
    s = new EncounterList();
  assert.ok(s.select(c, [portals[0]]).error);
  assert.equal(draw(s, c).intent, "breach");
});
test("menu or room target changes preserve list progress", () => {
  const c = config([normal("a"), normal("b")]),
    s = new EncounterList();
  draw(s, c);
  assert.equal(
    draw(s, { ...c, id: "new-room", targets: [12] }).selection.cardId,
    "b",
  );
});
test("each personality keeps its own progress", () => {
  const s = new EncounterList(),
    a = config([normal("a1"), normal("a2")], "ordered", "A"),
    b = config([normal("b1"), normal("b2")], "ordered", "B");
  draw(s, a);
  draw(s, b);
  assert.equal(draw(s, a).selection.cardId, "a2");
});
test("reshuffle can repeat before list exhaustion", () => {
  const c = config([
      normal("a"),
      { id: "shuffle", kind: "reshuffle" },
      normal("b"),
    ]),
    s = new EncounterList();
  assert.equal(draw(s, c).selection.cardId, "a");
  assert.equal(draw(s, c).selection.cardId, "a");
});
test("reshuffle-first prefix has bounded explicit fallback", () => {
  const c = config([{ id: "shuffle", kind: "reshuffle" }, normal("a")]),
    r = new EncounterList().select(c, portals);
  assert.equal(r.group.selection.cardId, "a");
  assert.ok(r.group.selection.fallback);
  assert.ok(r.events.length < 100);
});
test("all-invalid or reshuffle-only list reports no playable encounter", () => {
  for (const c of [
    config([breach]),
    config([{ id: "shuffle", kind: "reshuffle" }]),
  ])
    assert.ok(new EncounterList().select(c, [portals[0]]).error);
});
test("standalone keeps authored membership despite target and normal required tags", () => {
  const c = config([breach]);
  c.targets = [40];
  c.required = ["support"];
  const g = draw(new EncounterList(), c);
  assert.equal(g.cost, 8);
  assert.equal(g.members.length, 4);
  assert.equal(g.target, 8);
});
test("standalone must still satisfy shared member champion average compatibility limits", () => {
  for (const rules of [
    { maxMembers: 3 },
    { maxAverageCost: 1 },
    { incompatiblePairs: [["guard", "guard"]] },
  ]) {
    const c = config();
    Object.assign(c.rules, rules);
    assert.equal(composeStandalone(c, c.groups[0]), null);
  }
});
test("group suitability supports enforce prefer and ignore", () => {
  const c = config([breach]);
  c.groups[0].tags = [];
  assert.ok(new EncounterList().select(c, portals).error);
  for (const policy of ["prefer", "ignore"])
    assert.equal(
      draw(new EncounterList(), {
        ...c,
        selection: {
          ...c.selection,
          cards: [{ ...breach, groupTagPolicy: policy }],
        },
      }).cost,
      8,
    );
});
test("portal tag policy can ignore design convention but still needs breach opportunity", () => {
  const c = config([
    { ...breach, portalTags: ["small-only"], portalTagPolicy: "ignore" },
  ]);
  assert.equal(draw(new EncounterList(), c).portalId, "seal");
  assert.ok(new EncounterList().select(c, [portals[0]]).error);
});
test("card multiplier changes normal target without changing funding rate", () => {
  const c = config([normal("large", 1.5)]),
    g = draw(new EncounterList(), c);
  assert.equal(g.target, 12);
  assert.equal(g.cost, 12);
  assert.equal(c.flowRate, 2);
});
test("malformed cards and unknown member IDs reject before runtime mutation", () => {
  for (const mutate of [
    (c) => (c.selection.mode = "bad"),
    (c) => c.selection.cards.push(normal("one")),
    (c) => (c.groups[0].members = ["unknown"]),
    (c) => (c.selection.cards[0].targetMultiplier = 0),
  ]) {
    const c = config();
    mutate(c);
    assert.throws(() => validateSelection(c));
  }
});
test("selector snapshots and resolved groups are detached", () => {
  const s = new EncounterList(),
    c = config();
  const g = draw(s, c);
  g.members[0].cost = 999;
  s.snapshot().remaining.length = 0;
  assert.equal(c.enemies[0].cost, 2);
  assert.equal(s.snapshot().remaining.length, 2);
});
test("unaffordable commitment waits without drawing again", () => {
  const { m, adapter } = setup();
  m.drainEvents();
  m.tick(1, adapter);
  assert.ok(m.next);
  const next = m.next;
  for (let i = 0; i < 5; i++) m.tick(0.1, adapter);
  assert.equal(m.next, next);
  assert.ok(!m.drainEvents().some((e) => e.type === "card-drawn"));
});
test("ordinary mode change preserves committed group", () => {
  const { m } = setup();
  const next = m.next;
  m.updateConfig(config(undefined, "random"));
  assert.equal(m.next, next);
});
test("breach suppresses forecast but dispatches immediately once funded", () => {
  const { m, adapter } = setup(config([breach]));
  m.addPotential(20, "zone");
  m.tick(3.5, adapter);
  assert.equal(m.available, 7);
  assert.equal(m.dispatch, null);
  m.tick(0.5, adapter);
  assert.equal(m.spent, 8);
  assert.ok(!m.drainEvents().some((e) => e.type === "warning-started"));
});
test("disappearing assigned portal cancels breach instead of front-door fallback", () => {
  const { m } = setup(config([breach, normal("fallback")]));
  assert.equal(m.next.intent, "breach");
  m.updatePortals([portals[0]]);
  assert.equal(m.next, null);
  assert.ok(m.drainEvents().some((e) => e.type === "selection-canceled"));
});
test("committed post-spawn portal update prevents repeated use of same seal", () => {
  const { m, adapter } = setup(config([breach]));
  adapter.commitSpawn = (p) => ({
    success: true,
    actorIds: p.members.map((_, i) => i + 1),
    portals: [
      portals[0],
      { ...portals[1], breachable: false, tags: ["side-open"] },
    ],
  });
  m.addPotential(20, "zone");
  m.transfer(8);
  m.tick(0, adapter);
  assert.equal(m.spent, 8);
  assert.equal(m.next, null);
  assert.equal(m.snapshot().portals[1].breachable, false);
});
test("invalid returned portal descriptors cannot spend fuel", () => {
  const { m, adapter } = setup();
  m.addPotential(20, "zone");
  m.transfer(20);
  adapter.commitSpawn = (p) => ({
    success: true,
    actorIds: p.members.map((_, i) => i + 1),
    portals: [{ id: "bad" }],
  });
  assert.throws(() => m.tick(0, adapter));
  assert.equal(m.spent, 0);
});
test("final spending bypasses deck and does not consume its cards", () => {
  const { m } = setup();
  const before = m.snapshot().selection;
  m.addPotential(5, "zone");
  m.beginFinalSpend("end");
  assert.equal(m.next.finalSpend, true);
  assert.deepEqual(m.snapshot().selection, before);
});
test("invalid selection update leaves current commitment intact", () => {
  const { m } = setup(),
    next = m.next,
    c = config();
  c.selection.mode = "bad";
  assert.throws(() => m.updateConfig(c));
  assert.equal(m.next, next);
});
test("absolute authored normal targets ignore stage target changes", () => {
  const c = config([{ id: "exact", kind: "normal", target: 12 }]);
  c.targets = [30];
  assert.equal(draw(new EncounterList(), c).target, 12);
});
test("language-neutral seeded golden vector matches exactly", () => {
  const v = JSON.parse(fs.readFileSync("selection-golden-vector.json", "utf8")),
    c = config(
      v.cards.map((id) => normal(id)),
      v.mode,
      v.listId,
    ),
    s = new EncounterList(v.seed);
  assert.deepEqual(
    v.expectedDraws.map(() => draw(s, c).selection.cardId),
    v.expectedDraws,
  );
});
test("losing an enforced portal keyword cancels its committed opportunity", () => {
  const { m } = setup(config([breach, normal("fallback")]));
  m.updatePortals([portals[0], { ...portals[1], tags: [] }]);
  assert.equal(m.next, null);
});
console.log(`${checks} extractable encounter selection checks passed.`);
