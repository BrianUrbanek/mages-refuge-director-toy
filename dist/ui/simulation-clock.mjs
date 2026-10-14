/** Browser clock adapter. Fixed simulation stepping remains in the game host. */
export class SimulationClock {
  constructor({ step, isTerminal, paint, refresh }) {
    Object.assign(this, {
      step,
      isTerminal,
      paint,
      refresh,
      running: false,
      speed: 1,
      last: null,
      lastRefresh: 0,
    });
  }
  toggle() {
    if (!this.isTerminal()) this.running = !this.running;
  }
  pause() {
    this.running = false;
  }
  frame(now) {
    const elapsed =
      this.last === null ? 0 : Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (this.running) {
      this.step(elapsed * this.speed);
      if (this.isTerminal()) this.pause();
    }
    this.paint(elapsed);
    if (now - this.lastRefresh > 120) {
      this.refresh();
      this.lastRefresh = now;
    }
  }
}
