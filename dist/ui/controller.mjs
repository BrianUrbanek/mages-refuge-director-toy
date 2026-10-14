import { RefugeSimulation } from "../game/refuge-simulation.mjs";
import { CrowdView } from "../display/crowd-view.mjs";
import { createRenderer } from "./render-state.mjs";
import { createProgressStore } from "./progress-store.mjs";
import { SimulationClock } from "./simulation-clock.mjs";
import { colorForActor } from "./appearance.mjs";
import { escapeHtml as esc } from "./format.mjs";
import { createPlayerStatsEditor } from "./player-stats-editor.mjs";
import { ArenaView } from "../display/arena-view.mjs";
import { mountReleaseNotes } from "./release-notes.mjs";

/** Composition root: commands go inward; detached read models flow outward. */
export function mountRefuge(document, window) {
  const $ = (id) => document.getElementById(id),
    sim = new RefugeSimulation();
  const store = createProgressStore(window.localStorage),
    renderer = createRenderer(document);
  let roster = "a";
  const crowd = new CrowdView($("crowdCanvas"), (id) => sim.selectTarget(id), {
    colorForActor,
  });
  const arena = new ArenaView({
    arena: document.querySelector(".arena"),
    traveler: document.querySelector(".traveler"),
    front: $("entrance-front"),
    rear: $("entrance-rear"),
    notice: $("travelNotice"),
    floorLabel: $("floorLabel"),
    reducedMotion: () =>
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  });
  mountReleaseNotes(document);
  const refresh = () => {
    const state = sim.viewState();
    renderer.render(state, { running: clock.running, store: store.snapshot() });
    renderer.renderRoster(state, roster);
  };
  const clock = new SimulationClock({
    step: (dt) => sim.tick(dt),
    isTerminal: () => sim.isTerminal(),
    paint: (dt) => {
      const scene = sim.sceneSnapshot(),
        projection = arena.render(scene, dt * clock.speed);
      crowd.render(scene, dt, projection);
    },
    refresh,
  });
  const action = (fn) => {
    fn();
    refresh();
  };
  const selectPanel = (id, focus = false) => {
    document.querySelectorAll("[data-panel]").forEach((b) => {
      const active = b.dataset.panel === id;
      b.setAttribute("aria-selected", String(active));
      b.tabIndex = active ? 0 : -1;
      $("panel-" + b.dataset.panel).hidden = !active;
      if (active && focus) b.focus();
    });
    document.querySelector(".panel-viewport").scrollTop = 0;
  };
  const resetActivity = (sanctum, stats = sim.viewState().playerStats) => {
    sim.restartAtDepth($("depth").value, sanctum, stats);
    if ($("bossExclude").value && !sanctum)
      sim.excludeBoss($("bossExclude").value);
    crowd.reset();
    arena.reset();
    renderer.reset();
    clock.pause();
    selectPanel("director");
  };
  const initial = sim.viewState();
  $("burstStrategy").innerHTML = Object.entries(initial.burstStrategies)
    .map(([id, value]) => `<option value="${id}">${esc(value.name)}</option>`)
    .join("");
  $("burstStrategy").onchange = () =>
    action(() => sim.setBurstStrategy($("burstStrategy").value));
  createPlayerStatsEditor(document, {
    options: initial.playerStatOptions,
    defaults: initial.playerStatDefaults,
    active: initial.playerStats,
    onApply: (stats) =>
      action(() => resetActivity(sim.viewState().sanctum, stats)),
  });
  $("menuSelect").innerHTML = Object.entries(initial.rosterMenus)
    .map(([id, m]) => `<option value="${id}">${esc(m.name)}</option>`)
    .join("");
  $("bossExclude").innerHTML =
    '<option value="">Exclude one final boss…</option>' +
    initial.bossChoices.map((name) => `<option>${esc(name)}</option>`).join("");
  $("play").onclick = () => action(() => clock.toggle());
  $("reset").onclick = () =>
    action(() => resetActivity(sim.viewState().sanctum));
  $("newRefuge").onclick = () => action(() => resetActivity(false));
  $("selectionMode").onchange = () =>
    action(() => sim.setSelectionMode($("selectionMode").value));
  $("personality").onchange = () =>
    action(() => sim.setPersonality($("personality").value));
  $("bossExclude").onchange = () =>
    action(() => sim.excludeBoss($("bossExclude").value));
  $("routeChoice").onchange = () =>
    action(() => sim.setRoute($("routeChoice").value));
  $("hold").onclick = () => action(() => sim.toggleAdvancement());
  $("priority").onchange = () =>
    action(() => sim.setPriority($("priority").value));
  $("numbers").onchange = () => {
    crowd.showNumbers = $("numbers").checked;
  };
  $("speeds").onclick = (e) => {
    const b = e.target.closest("[data-speed]");
    if (!b) return;
    clock.speed = Number(b.dataset.speed);
    $("speeds")
      .querySelectorAll("button")
      .forEach((x) => {
        x.classList.toggle("active", x === b);
        x.setAttribute("aria-pressed", String(x === b));
      });
  };
  const handleDoor = (e) => {
    const guardian = e.target.closest("[data-guardian]"),
      advance = e.target.closest("[data-advance]"),
      breach = e.target.closest("[data-breach]");
    if (guardian) action(() => sim.faceGuardian(guardian.dataset.guardian));
    if (advance)
      action(() => sim.advance(false, advance.dataset.advance || null));
    if (breach) action(() => sim.advance(true, breach.dataset.breach || null));
  };
  $("doors").onclick = handleDoor;
  $("alternateDoors").onclick = handleDoor;
  $("rosterTabs").onclick = (e) => {
    const b = e.target.closest("[data-roster]");
    if (b) {
      roster = b.dataset.roster;
      refresh();
    }
  };
  $("progress").onclick = () => action(() => sim.advance());
  $("releaseHere").onclick = () => action(() => sim.releaseHere());
  $("chest").onclick = () => action(() => sim.chest());
  $("menuApply").onclick = () =>
    action(() => sim.setMenu($("menuSelect").value));
  $("invalidate").onclick = () => action(() => sim.invalidate());
  $("trigger").onclick = () => action(() => sim.trigger());
  $("routes").onclick = (e) => {
    const b = e.target.closest("[data-route]");
    if (b) action(() => sim.toggleEntrance(b.dataset.route));
  };
  $("return").onclick = () =>
    action(() => {
      const state = sim.viewState();
      if (sim.finish()) {
        store.bank(state.earned, !state.sanctum);
        clock.pause();
      }
    });
  $("sanctum").onclick = () =>
    action(() => {
      if (store.enterSanctum()) {
        resetActivity(true);
      }
    });
  $("help").onclick = () => $("guide").showModal();
  $("closeGuide").onclick = () => $("guide").close();
  $("startGuide").onclick = () => $("guide").close();
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(sim.exportTrace(), null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "refuge-run-trace.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $("export").onclick = download;
  $("exportJournal").onclick = download;
  $("copyJournal").onclick = async () => {
    const button = $("copyJournal");
    try {
      await window.navigator.clipboard.writeText(sim.exportJournalLog());
      button.textContent = "Copied";
    } catch {
      button.textContent = "Copy unavailable · use Export";
    }
    setTimeout(() => {
      button.textContent = "Copy log";
    }, 2500);
  };
  $("resultsButton").onclick = () => {
    selectPanel("journal");
    refresh();
  };
  $("journalFilter").onchange = refresh;
  document.querySelector(".console-tabs").onclick = (e) => {
    const b = e.target.closest("[data-panel]");
    if (b) {
      selectPanel(b.dataset.panel);
      refresh();
    }
  };
  document.querySelector(".console-tabs").onkeydown = (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const tabs = [...document.querySelectorAll("[data-panel]")],
      index = tabs.indexOf(document.activeElement);
    if (index < 0) return;
    e.preventDefault();
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? tabs.length - 1
          : (index + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) %
            tabs.length;
    selectPanel(tabs[next].dataset.panel, true);
    refresh();
  };
  $("progressionOptions").onclick = (e) => {
    const b = e.target.closest("[data-progression]");
    if (b) action(() => sim.setProgression(b.dataset.progression));
  };
  $("routeRail").open = window.innerWidth > 900;
  let frameId = null,
    disposed = false;
  const frame = (now) => {
    if (disposed) return;
    clock.frame(now);
    frameId = window.requestAnimationFrame(frame);
  };
  refresh();
  frameId = window.requestAnimationFrame(frame);
  return {
    dispose: () => {
      disposed = true;
      clock.pause();
      window.cancelAnimationFrame(frameId);
    },
  };
}
