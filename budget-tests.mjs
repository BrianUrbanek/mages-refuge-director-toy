import assert from "node:assert/strict";
import { EncounterManager } from "./dist/core/encounter-manager.mjs";
import { fixture } from "./core-fixture.mjs";
let checks = 0,
  serial = 0;
const test = (name, fn) => {
  fn();
  checks++;
  console.log("PASS " + name);
};
const adapter = {
  assetsReady: () => true,
  canEnter: () => true,
  commitSpawn: (g) => ({
    success: true,
    actorIds: g.members.map(() => ++serial),
  }),
};
function manager(total) {
  const m = new EncounterManager({
    config: fixture,
    runtime: { budgetAwareComposition: true },
  });
  m.addPotential(total, "zone");
  m.updatePortals([{ id: "door", tags: [], eligible: true }]);
  return m;
}
test("final tail expands selected recipe and transfers only half its actual added cost", () => {
  const m = manager(11);
  m.transfer(4);
  m.tick(0, adapter);
  assert.equal(m.next.cost, 10);
  assert.equal(m.next.foldedFuel, 2);
  assert.equal(m.available, 5);
  assert.equal(m.potential, 6);
  assert.equal(m.fundingEta(), 2.5);
  const frozen = m.next;
  m.tick(0.5, adapter);
  assert.equal(m.next, frozen);
  assert.equal(m.available, 6);
  m.verify();
});
test("composer fits an intended group within total remaining balance", () => {
  const m = manager(6);
  m.tick(0, adapter);
  assert.equal(m.next.cost, 6);
  assert.ok(m.next.cost <= m.available + m.potential);
});
test("sub-core terminal composition obeys budget and reports discrete residue", () => {
  const m = manager(3);
  m.tick(0, adapter);
  assert.equal(m.next.cost, 2);
  assert.ok(m.next.terminalComposition);
  m.tick(1, adapter);
  assert.equal(m.spent, 2);
  assert.ok(m.budgetComplete);
  assert.equal(m.next, null);
  assert.equal(m.available + m.potential, 1);
  m.verify();
});
test("funded folded group dispatches immediately without an added warning delay", () => {
  const m = manager(11);
  m.transfer(Infinity);
  m.tick(0, adapter);
  assert.equal(m.spent, 10);
  assert.ok(m.budgetComplete);
});
test("new fuel resumes an exhausted Director without modifying a frozen group", () => {
  const m = manager(1);
  m.tick(0, adapter);
  assert.ok(m.budgetComplete);
  m.applyOnce("new", { add: 20 });
  m.tick(0, adapter);
  assert.ok(m.next);
  const p = m.next;
  m.applyOnce("more", { add: 8 });
  m.tick(0, adapter);
  assert.equal(m.next, p);
});
test("fixed breach recipes remain unexpanded within total balance", () => {
  const cfg = {
    ...fixture,
    groups: [
      {
        id: "breach",
        standalone: true,
        tags: ["breach"],
        members: ["guard", "guard", "guard", "guard"],
      },
    ],
    selection: {
      id: "test",
      mode: "ordered",
      cards: [{ id: "breach", kind: "breach", groupTags: ["breach"] }],
    },
  };
  const m = new EncounterManager({
    config: cfg,
    runtime: { budgetAwareComposition: true },
  });
  m.addPotential(9, "zone");
  m.updatePortals([{ id: "seal", eligible: true, breachable: true, tags: [] }]);
  m.tick(0, adapter);
  assert.equal(m.next.cost, 8);
  assert.equal(m.next.members.length, 4);
  assert.equal(m.next.foldedFuel, undefined);
  assert.equal(m.available, 0);
});
console.log(`${checks} independent remaining-budget checks passed.`);
