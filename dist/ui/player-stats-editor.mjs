import { escapeHtml } from "./format.mjs";
/** Pending UI settings; does not mutate the running game or import game modules. */
export function createPlayerStatsEditor(
  document,
  { options, defaults, active, onApply },
) {
  const panel = document.getElementById("playerStatsFields");
  let draft = { ...active };
  const note = document.getElementById("playerStatsPending");
  panel.innerHTML = options
    .map(
      (o) =>
        `<label class="stat-step" for="stat-${o.key}"><span>${escapeHtml(o.label)} <output id="value-${o.key}" for="stat-${o.key}"></output></span><input id="stat-${o.key}" data-stat="${o.key}" type="range" min="0" max="${o.steps.length - 1}" step="1"><small>${o.steps.map((v) => v + o.unit).join(" · ")} · Baseline ${o.baseline}${o.unit}</small></label>`,
    )
    .join("");
  function refresh(syncInputs = false) {
    for (const o of options) {
      const input = document.getElementById("stat-" + o.key);
      if (syncInputs) input.value = String(o.steps.indexOf(draft[o.key]));
      input.setAttribute("aria-valuetext", draft[o.key] + o.unit);
      document.getElementById("value-" + o.key).textContent =
        draft[o.key] + o.unit;
    }
    const dirty = options.some((o) => draft[o.key] !== active[o.key]);
    note.textContent = dirty
      ? "Changes pending · apply to restart paused with full resources."
      : "Active settings · edits apply on restart. Baseline values are marked below.";
    document.getElementById("applyPlayerStats").disabled = !dirty;
  }
  panel.oninput = (e) => {
    const o = options.find((o) => o.key === e.target.dataset.stat);
    if (!o) return;
    draft[o.key] = o.steps[Number(e.target.value)];
    refresh();
  };
  document.getElementById("restorePlayerStats").onclick = () => {
    draft = { ...defaults };
    refresh(true);
  };
  document.getElementById("applyPlayerStats").onclick = () => {
    onApply({ ...draft });
    active = { ...draft };
    refresh(true);
    document.getElementById("player-controls").scrollTop = 0;
  };
  refresh(true);
}
