/** Zone-owned boss deadline. No Director, rooms, actors or browser dependencies. */
export class BossClock {
  constructor({ longSeconds = 10, shortSeconds = 6 } = {}) {
    if (
      !Number.isFinite(longSeconds) ||
      !Number.isFinite(shortSeconds) ||
      shortSeconds < 0 ||
      longSeconds < shortSeconds
    )
      throw new Error("Invalid boss countdown settings");
    Object.assign(this, {
      longSeconds,
      shortSeconds,
      deadline: null,
      mode: null,
      spawned: false,
    });
  }
  update(time, { lastRoomEntered = false, zoneComplete = false } = {}) {
    if (this.spawned) return false;
    if (this.deadline === null) {
      if (zoneComplete) {
        this.mode = "short";
        this.deadline = time + this.shortSeconds;
      } else if (lastRoomEntered) {
        this.mode = "long";
        this.deadline = time + this.longSeconds;
      }
    } else if (this.mode === "long" && zoneComplete) {
      this.deadline -= this.longSeconds - this.shortSeconds;
      this.mode = "short";
    }
    if (this.deadline !== null && time + 1e-7 >= this.deadline) {
      this.spawned = true;
      return true;
    }
    return false;
  }
  snapshot() {
    return {
      deadline: this.deadline,
      mode: this.mode,
      spawned: this.spawned,
      longSeconds: this.longSeconds,
      shortSeconds: this.shortSeconds,
    };
  }
}
