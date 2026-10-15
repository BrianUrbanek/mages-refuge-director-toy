import {
  CROSSING_DELAY,
  EXIT_DURATION,
  ENTRY_DURATION,
} from "./room-transition.mjs";
const CENTER = { x: 0.5, y: 0.57 };
const mix = (a, b, t) => {
  const u = Math.max(0, Math.min(1, t));
  const s = u * u * (3 - 2 * u);
  return { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s };
};

/** A short, ordered arena replay. Simulation and controls never wait for it.
 * Snapshots arrive in presentation-clock order, including paused manual entries.
 * Travel previews the next room; the whole scene switches at rear re-entry.
 */
export class SceneTimeline {
  constructor() {
    this.reset();
  }
  reset() {
    this.clock = 0;
    this.frames = [];
    this.lastRoom = null;
    this.enteredAt = -Infinity;
  }
  update(scene, dt, options = {}) {
    this.clock += Math.max(0, dt);
    if (!this.frames.length) {
      this.frames.push({ at: -CROSSING_DELAY, scene });
    }
    this.frames.push({ at: this.clock, scene });
    const cutoff = this.clock - (options.reducedMotion ? 0 : CROSSING_DELAY);
    while (this.frames.length > 1 && this.frames[1].at <= cutoff + 1e-9)
      this.frames.shift();
    let displayed = this.frames[0].scene;
    // Anticipate only the first pending room, never coalesce past intervening rooms.
    const next = this.frames.find(
      (f) => f.scene.location.roomId !== displayed.location.roomId,
    );
    const destination = next?.scene.location ?? displayed.location;
    // Show the actual departure instant (including the final kill) during exit,
    // rather than suggesting the player chose to leave while old enemies lived.
    if (next?.scene.departure?.location.roomId === displayed.location.roomId)
      displayed = next.scene.departure;
    // The timestamped scene is authoritative for floor/door/actor identity.
    // Fixed-frame quantization must never show a new room during an old exit.
    const switched =
      this.lastRoom !== null && this.lastRoom !== displayed.location.roomId;
    this.lastRoom = displayed.location.roomId;
    if (switched) this.enteredAt = this.frames[0].at;
    const front = options.front ?? { x: 0.86, y: 0.7 },
      rear = options.rear ?? { x: 0.14, y: 0.7 };
    let phase = "idle",
      traveler = { ...CENTER, opacity: 1 };
    if (!options.reducedMotion && next) {
      const elapsed = CROSSING_DELAY - (next.at - cutoff);
      phase = elapsed < EXIT_DURATION ? "exiting" : "hidden";
      traveler = {
        ...mix(CENTER, front, elapsed / EXIT_DURATION),
        opacity: Math.max(0, Math.min(1, (EXIT_DURATION - elapsed) / 0.1)),
      };
    } else if (
      !options.reducedMotion &&
      cutoff - this.enteredAt < ENTRY_DURATION
    ) {
      const age = Math.max(0, cutoff - this.enteredAt);
      phase = "entering";
      traveler = {
        ...mix(rear, CENTER, age / ENTRY_DURATION),
        opacity: Math.min(1, age / 0.12),
      };
    }
    return {
      phase,
      traveler,
      location: displayed.location,
      destination,
      scene: displayed,
      floorChanged: destination.zoneId !== displayed.location.zoneId,
      sceneChanged: switched,
    };
  }
}
