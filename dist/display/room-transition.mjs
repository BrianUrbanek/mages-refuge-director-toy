const CENTER = { x: 0.5, y: 0.57 };
const EXIT = 0.55,
  HIDDEN = 0.12,
  ENTRY = 0.65;
const mix = (a, b, t) => {
  const u = t * t * (3 - 2 * t);
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
};
/** Pure presentation state. No simulation time, fuel, actors, or progression gates. */
export class RoomTransition {
  constructor() {
    this.reset();
  }
  reset() {
    this.target = null;
    this.displayed = null;
    this.elapsed = Infinity;
    this.from = { ...CENTER };
    this.traveler = { ...CENTER, opacity: 1 };
    this.previousZone = null;
  }
  update(
    location,
    dt,
    {
      front = { x: 0.86, y: 0.7 },
      rear = { x: 0.14, y: 0.7 },
      reducedMotion = false,
    } = {},
  ) {
    if (!this.target) {
      this.target = { ...location };
      this.displayed = { ...location };
    } else if (location.roomId !== this.target.roomId) {
      // Coalesce very rapid paused/manual commands instead of replaying stale rooms.
      if (this.elapsed >= EXIT + HIDDEN) {
        this.from = { x: this.traveler.x, y: this.traveler.y };
        this.previousZone = this.displayed.zoneId;
        this.elapsed = 0;
      }
      this.target = { ...location };
    }
    if (reducedMotion) this.elapsed = Infinity;
    else this.elapsed += Math.max(0, dt);
    let phase;
    if (this.elapsed < EXIT) {
      phase = "exiting";
      this.traveler = {
        ...mix(this.from, front, this.elapsed / EXIT),
        opacity: Math.min(1, (EXIT - this.elapsed) / 0.1),
      };
    } else if (this.elapsed < EXIT + HIDDEN) {
      phase = "hidden";
      this.traveler = { ...front, opacity: 0 };
    } else {
      this.displayed = { ...this.target };
      const age = this.elapsed - EXIT - HIDDEN;
      phase = age < ENTRY ? "entering" : "idle";
      this.traveler = {
        ...mix(rear, CENTER, Math.min(1, age / ENTRY)),
        opacity: Math.min(1, age / 0.12),
      };
    }
    return {
      phase,
      traveler: { ...this.traveler },
      location: { ...this.displayed },
      destination: { ...this.target },
      floorChanged:
        this.previousZone !== null && this.previousZone !== this.target.zoneId,
    };
  }
}
