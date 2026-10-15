import { SceneTimeline } from "./scene-timeline.mjs";
import { floorTheme, FLOOR_IMAGES } from "./floor-themes.mjs";
/** Cosmetic DOM/scene adapter; owns no game controls or simulation decisions. */
export class ArenaView {
  constructor({
    arena,
    traveler,
    front,
    rear,
    notice,
    floorLabel,
    reducedMotion = () => false,
  }) {
    Object.assign(this, {
      arena,
      traveler,
      front,
      rear,
      notice,
      floorLabel,
      reducedMotion,
    });
    this.motion = new SceneTimeline();
    this.zone = null;
    // Preload independently of encounter assets/readiness.
    this.preloads = FLOOR_IMAGES.map((src) => {
      const img = new Image();
      img.src = src;
      return img;
    });
  }
  reset() {
    this.motion.reset();
    this.zone = null;
  }
  anchor(element, fallback) {
    const r = this.arena.getBoundingClientRect(),
      p = element.getBoundingClientRect();
    return r.width && r.height
      ? {
          x: (p.left + p.width / 2 - r.left) / r.width,
          y: (p.top + p.height / 2 - r.top) / r.height,
        }
      : fallback;
  }
  render(scene, dt) {
    const state = this.motion.update(scene, dt, {
      front: this.anchor(this.front, { x: 0.86, y: 0.7 }),
      rear: this.anchor(this.rear, { x: 0.14, y: 0.7 }),
      reducedMotion: this.reducedMotion(),
    });
    this.traveler.style.left = state.traveler.x * 100 + "%";
    this.traveler.style.top = state.traveler.y * 100 + "%";
    this.traveler.style.opacity = state.traveler.opacity;
    this.traveler.dataset.phase = state.phase;
    if (this.zone !== state.location.zoneId) {
      this.zone = state.location.zoneId;
      const theme = floorTheme(this.zone);
      this.arena.style.backgroundImage = `linear-gradient(${theme.wash}, ${theme.wash}), url("${theme.image}")`;
      this.arena.dataset.zone = this.zone;
    }
    const crossing = state.phase !== "idle";
    this.arena.classList.toggle("is-crossing", crossing);
    this.floorLabel.textContent = state.location.zoneName;
    this.notice.hidden = !crossing;
    const text = `${state.floorChanged ? "New floor · " : ""}${state.phase === "exiting" ? "Through the front gate → " : "Entering · "}${state.destination.roomName}`;
    if (crossing && this.notice.textContent !== text)
      this.notice.textContent = text;
    return state;
  }
}
