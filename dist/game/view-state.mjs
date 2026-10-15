import { PLAYER_STAT_OPTIONS, DEFAULT_PLAYER_STATS } from "./player-stats.mjs";
import { BURST_STRATEGIES } from "./player-policy.mjs";
import { AREAS, MENUS, APPROACHES, configFor } from "../demo-data.mjs";

/** Translate the host into detached read models; no DOM, storage or canvas. */
export function createViewState(sim) {
  const director = sim.manager.snapshot();
  return structuredClone({
    ...sim.snapshot(),
    director,
    hp: sim.hp,
    maxHp: sim.combat.maxHp,
    maxCharges: sim.combat.maxCharges,
    playerStats: sim.playerStats,
    burstStrategy: sim.burstStrategy,
    burstStrategies: BURST_STRATEGIES,
    playerStatOptions: PLAYER_STAT_OPTIONS,
    playerStatDefaults: DEFAULT_PLAYER_STATS,
    failed: sim.failed,
    ended: sim.ended,
    victoryReady: sim.victoryReady,
    finalDefeated: sim.finalDefeated,
    sweepComplete: sim.sweepComplete,
    draining: sim.draining,
    wait: sim.wait,
    potential: sim.potential,
    available: sim.available,
    added: sim.added,
    spent: sim.spent,
    next: sim.next,
    dispatch: sim.dispatch,
    pending: sim.pending,
    t: sim.t,
    areaDef: sim.areaDef(),
    current: sim.current(),
    lastSub: sim.lastSub(),
    volumes: sim.volumes,
    zone: {
      ...sim.zone.snapshot(),
      currentZone: { budget: sim.zone.currentZone.budget },
    },
    entrances: sim.entrances.map((p) => ({
      ...p,
      eligible: !sim.next || sim.canEnter(sim.next, p.id),
    })),
    flow: sim.flow(),
    canSafe: sim.canSafe(),
    gateReady: sim.gateReady(),
    routeNext: sim.routeNext(),
    destinations: sim.destinations(),
    progressStatus: sim.progressStatus(),
    progression: sim.progression,
    approach: sim.approach,
    approachDescription: APPROACHES[sim.approach].description,
    hold: sim.hold,
    route: sim.route,
    power: sim.power,
    depth: sim.depth,
    personality: sim.personality,
    selectionMode: sim.selectionMode,
    selectionList: sim.manager.config.selection,
    priority: sim.priority,
    sanctum: sim.sanctum,
    livingCost: sim.livingCost(),
    incomingDps: sim.incomingDps(),
    regeneration: sim.combat.effectiveRegen(),
    potion: sim.combat.potionState(),
    earned: sim.earned,
    kills: sim.kills,
    breaches: sim.breaches,
    lieutenants: sim.lieutenants,
    lastBanner: sim.lastBanner,
    target: sim.target() ?? null,
    history: sim.history,
    chestApplied: sim.manager.isEventApplied("optional-chest"),
    sourcePotential: sim.manager.sourcePotential("zone:" + sim.area),
    bossExcluded: sim.events.has("boss-exclusion"),
    guardianAreas: [...sim.events]
      .filter((e) => e.startsWith("guardian-"))
      .map((e) => e.slice(9)),
    areas: AREAS,
    bossChoices: sim.bossChoices(),
    rosterMenus: Object.fromEntries(
      Object.entries(MENUS).map(([id, m]) => [
        id,
        { ...m, enemies: configFor(id, sim.personality, sim.depth).enemies },
      ]),
    ),
    journal: {
      ...sim.journal.snapshot(),
      liveSample: {
        time: sim.t,
        health: sim.hp,
        points: sim.livingCost(),
        actors: sim.actors.length,
        incomingDps: sim.incomingDps(),
      },
    },
    results: sim.runMetrics(),
  });
}

/** Small detached arena model; controls and inspector remain on current host state. */
export function createArenaState(sim) {
  const director = sim.manager.snapshot();
  return {
    t: sim.t,
    current: sim.current(),
    sub: sim.sub,
    areaDef: sim.areaDef(),
    actors: sim.actors,
    effects: sim.effects.filter((e) => e.roomId === sim.current().id),
    hasPlan: !!sim.next,
    entrances: sim.entrances.map((p) => ({
      ...p,
      eligible: !sim.next || sim.canEnter(sim.next, p.id),
    })),
    director: { fundingEta: director.fundingEta },
    dispatch: sim.dispatch,
    pending: sim.pending,
    wait: sim.wait,
    ended: sim.ended,
    failed: sim.failed,
    finalDefeated: sim.finalDefeated,
    sweepComplete: sim.sweepComplete,
    canSafe: sim.canSafe(),
  };
}
