/** Display assets keyed by opaque host location IDs. Never used by the Director. */
const themes = {
  entry: { image: "assets/refuge-chamber.png", wash: "transparent" },
  a: { image: "assets/refuge-barracks.png", wash: "transparent" },
  b1: { image: "assets/refuge-barracks.png", wash: "#24482966" },
  b2: { image: "assets/refuge-mirrors.png", wash: "#37184c44" },
  c: { image: "assets/refuge-mirrors.png", wash: "transparent" },
  boss: { image: "assets/refuge-inner.png", wash: "transparent" },
  liath: { image: "assets/refuge-chamber.png", wash: "#77480d33" },
};
export function floorTheme(zoneId) {
  return { ...(themes[zoneId] ?? themes.entry) };
}
export const FLOOR_IMAGES = Object.freeze([
  ...new Set(Object.values(themes).map((t) => t.image)),
]);
