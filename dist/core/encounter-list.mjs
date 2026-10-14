import { SeededRandom } from "./seeded-random.mjs";
import { clone } from "./contracts.mjs";
import { compileEncounterOpportunities } from "./encounter-opportunities.mjs";
export function validateSelection(config) {
  const s = config.selection;
  if (!s) return;
  if (
    typeof s.id !== "string" ||
    !s.id ||
    !["ordered", "random"].includes(s.mode) ||
    !Array.isArray(s.cards) ||
    !s.cards.length
  )
    throw new Error("Invalid encounter list");
  const ids = new Set();
  for (const c of s.cards) {
    if (
      typeof c.id !== "string" ||
      !c.id ||
      ids.has(c.id) ||
      !["normal", "breach", "standalone", "reshuffle"].includes(c.kind)
    )
      throw new Error("Invalid encounter card");
    ids.add(c.id);
    if (
      [c.target, c.targetMultiplier].some(
        (value) =>
          value !== undefined && (!Number.isFinite(value) || value <= 0),
      )
    )
      throw new Error("Invalid card target");
    for (const key of ["groupTags", "portalTags", "preferredTags"])
      if (
        c[key] !== undefined &&
        (!Array.isArray(c[key]) || c[key].some((t) => typeof t !== "string"))
      )
        throw new Error("Invalid card tags");
    for (const key of ["groupTagPolicy", "portalTagPolicy"])
      if (
        c[key] !== undefined &&
        !["enforce", "prefer", "ignore"].includes(c[key])
      )
        throw new Error("Invalid tag policy");
  }
  for (const key of ["minTarget", "maxTarget"])
    if (s[key] !== undefined && (!Number.isFinite(s[key]) || s[key] <= 0))
      throw new Error("Invalid selection target bound");
  if (s.minTarget > s.maxTarget) throw new Error("Reversed selection bounds");
  if (config.groups !== undefined && !Array.isArray(config.groups))
    throw new Error("Invalid group catalog");
  const groupIds = new Set(),
    enemies = new Set(config.enemies.map((e) => e.id));
  for (const g of config.groups ?? []) {
    if (
      typeof g.id !== "string" ||
      !g.id ||
      groupIds.has(g.id) ||
      typeof g.standalone !== "boolean" ||
      !Array.isArray(g.tags) ||
      g.tags.some((t) => typeof t !== "string") ||
      !Array.isArray(g.members) ||
      !g.members.length ||
      g.members.some((id) => !enemies.has(id)) ||
      (g.portalPreferences !== undefined &&
        (!Array.isArray(g.portalPreferences) ||
          g.portalPreferences.some((t) => typeof t !== "string")))
    )
      throw new Error("Invalid authored standalone group");
    groupIds.add(g.id);
  }
}
/** Deterministic selection without replacement. State belongs to each list identity/mode. */
export class EncounterList {
  #states = new Map();
  #random;
  #active = null;
  constructor(seed = 1) {
    this.#random = new SeededRandom(seed);
  }
  select(config, portals, ordinal = 0, totalBudget = Infinity) {
    validateSelection(config);
    const s = config.selection,
      { resolved, excluded } = compileEncounterOpportunities(
        s,
        config,
        portals,
        ordinal,
        totalBudget,
      );
    const key = s.id + "|" + s.mode + "|" + JSON.stringify(s.cards);
    this.#active = key;
    let state = this.#states.get(key);
    if (!state) {
      state = {
        listId: s.id,
        mode: s.mode,
        remaining: [],
        cycle: 0,
        excluded: [],
      };
      this.#states.set(key, state);
    }
    const events = [];
    if (JSON.stringify(excluded) !== JSON.stringify(state.excluded)) {
      state.excluded = excluded;
      events.push({ type: "cards-filtered", listId: s.id, excluded });
    }
    const refill = () => {
      state.remaining = s.cards
        .filter((c) => resolved.has(c.id))
        .map((c) => c.id);
      state.cycle++;
      events.push({ type: "list-refilled", listId: s.id, cycle: state.cycle });
    };
    const playable = s.cards.filter(
      (c) => resolved.has(c.id) && c.kind !== "reshuffle",
    );
    if (!playable.length)
      return {
        error: "No valid encounter cards for current opportunities",
        events,
      };
    for (let attempt = 0; attempt < s.cards.length * 4 + 4; attempt++) {
      // Current opportunity changes consume invalid remaining cards, without reordering others.
      state.remaining = state.remaining.filter((id) => resolved.has(id));
      if (!state.remaining.length) refill();
      const i =
          s.mode === "ordered" ? 0 : this.#random.index(state.remaining.length),
        id = state.remaining.splice(i, 1)[0],
        card = s.cards.find((c) => c.id === id);
      events.push({
        type: "card-drawn",
        listId: s.id,
        cardId: id,
        kind: card.kind,
        cycle: state.cycle,
        mode: s.mode,
      });
      if (card.kind === "reshuffle") {
        refill();
        continue;
      }
      return {
        group: {
          ...clone(resolved.get(id)),
          selection: {
            listId: s.id,
            cardId: id,
            kind: card.kind,
            cycle: state.cycle,
            mode: s.mode,
          },
        },
        events,
      };
    }
    // Explicit bounded fallback, so a reshuffle-only prefix never loops indefinitely.
    const card = playable[0];
    state.remaining = state.remaining.filter((id) => id !== card.id);
    events.push({
      type: "selection-fallback",
      listId: s.id,
      cardId: card.id,
      reason: "Reshuffle draw limit",
    });
    return {
      group: {
        ...clone(resolved.get(card.id)),
        selection: {
          listId: s.id,
          cardId: card.id,
          kind: card.kind,
          cycle: state.cycle,
          mode: s.mode,
          fallback: true,
        },
      },
      events,
    };
  }
  snapshot() {
    const s = this.#states.get(this.#active);
    return clone(
      s
        ? { ...s, randomState: this.#random.state }
        : {
            remaining: [],
            cycle: 0,
            excluded: [],
            randomState: this.#random.state,
          },
    );
  }
}
