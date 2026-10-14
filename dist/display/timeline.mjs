/** Pure SVG geometry from journal samples and events. No game/director access. */
export function timelineGeometry(samples, entries, maxHealth = 100) {
  if (!samples.length)
    return {
      health: "",
      pressure: "",
      markers: [],
      maxPoints: 20,
      start: 0,
      end: 1,
    };
  const start = samples[0].time,
    end = Math.max(start + 1, samples.at(-1).time),
    maxPoints = Math.max(20, ...samples.map((s) => s.points));
  const x = (t) => ((t - start) / (end - start)) * 600;
  const path = (key, max) =>
    samples
      .map(
        (s, i) =>
          `${i ? "L" : "M"} ${x(s.time).toFixed(2)} ${(90 - (s[key] / max) * 75).toFixed(2)}`,
      )
      .join(" ");
  return {
    health: path("health", maxHealth),
    pressure: path("points", maxPoints),
    maxPoints,
    start,
    end,
    markers: entries
      .filter(
        (e) =>
          e.time >= start &&
          e.time <= end &&
          ["room", "arrival", "burst"].includes(e.kind),
      )
      .map((e) => ({ x: x(e.time), kind: e.kind, text: e.text, time: e.time })),
  };
}
