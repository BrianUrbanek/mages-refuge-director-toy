/** Shared visual coordinates for blocks, beams, labels and death markers. */
export function actorPosition(actor) {
  const start = actor.spawnPoint ?? actor.position;
  const t = Math.max(0, Math.min(1, actor.age / 0.6));
  return {
    x: start.x + (actor.position.x - start.x) * t,
    y: start.y + (actor.position.y - start.y) * t,
  };
}
export function effectVisible(effect, time, duration) {
  const age = time - effect.time;
  return age >= 0 && age < duration;
}
