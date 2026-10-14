/** Observational fight boundaries: overlapping arrivals belong to one fight. */
export class CombatSummary {
  constructor(onComplete) {
    this.onComplete = onComplete;
    this.active = null;
  }

  observe(time, state, context) {
    if (!this.active && state.actors > 0) {
      this.active = {
        startedAt: time,
        startHealth: state.health,
        previousHealth: state.health,
        previousHealing: state.potionHealing ?? 0,
        startKills: state.defeats ?? 0,
        startBursts: state.bursts ?? 0,
        startPotions: state.potionsUsed ?? 0,
        startHealing: state.potionHealing ?? 0,
        healthLost: 0,
        peakActors: 0,
        peakPoints: 0,
        groups: 0,
        fuel: 0,
        scriptedLeaders: 0,
        rooms: [],
        context: structuredClone(context),
      };
    }
    const fight = this.active;
    if (!fight) return;
    const healing = state.potionHealing ?? 0;
    // Health lost after passive regen; potion healing cannot hide that loss.
    fight.healthLost += Math.max(
      0,
      fight.previousHealth + healing - fight.previousHealing - state.health,
    );
    fight.previousHealth = state.health;
    fight.previousHealing = healing;
    fight.peakActors = Math.max(fight.peakActors, state.actors);
    fight.peakPoints = Math.max(fight.peakPoints, state.points);
    if (context.room && !fight.rooms.includes(context.room))
      fight.rooms.push(context.room);
    fight.endHealth = state.health;
    fight.defeats = (state.defeats ?? 0) - fight.startKills;
    fight.bursts = (state.bursts ?? 0) - fight.startBursts;
    fight.potions = (state.potionsUsed ?? 0) - fight.startPotions;
    fight.potionHealing = healing - fight.startHealing;
    if (!state.actors) this.finish(time, "cleared");
  }

  arrival(time, state, context, { fuel = 0, groups = 0, scriptedLeaders = 0 }) {
    this.observe(time, state, context);
    if (!this.active) return;
    this.active.fuel += fuel;
    this.active.groups += groups;
    this.active.scriptedLeaders += scriptedLeaders;
  }

  finish(time, outcome) {
    if (!this.active) return;
    const {
      previousHealth,
      previousHealing,
      startKills,
      startBursts,
      startPotions,
      startHealing,
      context,
      ...data
    } = this.active;
    this.active = null;
    this.onComplete(
      time,
      {
        ...data,
        duration: time - data.startedAt,
        outcome,
        netHealthChange: data.endHealth - data.startHealth,
      },
      context,
    );
  }
}
