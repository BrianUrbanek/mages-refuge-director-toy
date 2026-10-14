/** Presentation colors never enter director or game logic. */
export const MENU_COLORS = {
  ward: "#83b9c4",
  a: "#e4bb71",
  b1: "#b3ca84",
  b2: "#bf9de5",
  c: "#7bd2cf",
  boss: "#ec8f87",
  liath: "#f1c18e",
};
export const colorForActor = (actor) => MENU_COLORS[actor.menu] ?? "#83b9c4";
