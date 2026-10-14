import { fmt, time, escapeHtml as esc } from "./format.mjs";
import { timelineGeometry } from "../display/timeline.mjs";

/** Read-only journal and result presentation. */
export function createJournalView(document) {
  const $ = (id) => document.getElementById(id);
  let lastKey = "",
    lastOutcome = null;
  return (view) => {
    const filter = $("journalFilter").value,
      j = view.journal,
      r = view.results;
    if (r.outcome !== lastOutcome) {
      $("resultDetails").open = r.outcome !== "in-progress";
      lastOutcome = r.outcome;
    }
    const key = `${j.version}:${filter}:${r.outcome}:${Math.floor(r.elapsed)}:${JSON.stringify(r.playerStats)}`;
    if (key === lastKey) return;
    lastKey = key;
    $("resultTitle").textContent =
      r.outcome === "in-progress" ? "Run so far" : "Run results · " + r.outcome;
    $("runResults").innerHTML = [
      ["Elapsed", time(r.elapsed)],
      ["Quiet time", time(r.quietTime)],
      ["Lowest HP", fmt(r.minimumHealth)],
      ["Peak living points", fmt(r.peakLivingPoints)],
      ["Peak enemies", r.peakActors],
      ["Bursts spent", r.bursts],
      [
        "Potions used",
        `${r.potionsUsed} · ${fmt(r.potionHealing)} HP restored`,
      ],
      ["Groups spawned", r.groups],
      ["Fuel spent", `${fmt(r.fuelSpent)} / ${fmt(r.fuelIntroduced)}`],
    ]
      .map(
        ([label, value]) => `<div><small>${label}</small><b>${value}</b></div>`,
      )
      .join("");
    $("resultContext").textContent =
      `${r.progression} · ${r.burstStrategy} charges · ${r.personality} · ${r.route} route · depth ${r.depth} · seed ${r.seed}. Player: ${r.playerStats.maxHp} HP, ${r.playerStats.power} DPS, ${r.playerStats.regen} regen, ${r.playerStats.maxCharges} charges, ${r.playerStats.maxPotions} potions. Quiet time means no living enemies. Scripted leaders are outside Director fuel.`;
    const samples = j.liveSample ? [...j.samples, j.liveSample] : j.samples;
    const geometry = timelineGeometry(
      samples,
      j.timelineEntries,
      r.playerStats.maxHp,
    );
    $("timelineHealth").setAttribute("d", geometry.health);
    $("timelinePressure").setAttribute("d", geometry.pressure);
    $("timelineMarks").innerHTML = geometry.markers
      .map(
        (m) =>
          `<line x1="${m.x}" x2="${m.x}" y1="10" y2="95" class="marker-${m.kind}"><title>${time(m.time)} · ${esc(m.text)}</title></line>`,
      )
      .join("");
    $("timelineRange").textContent =
      `${time(geometry.start)}–${time(geometry.end)} · HP 0–${r.playerStats.maxHp} · living points 0–${fmt(geometry.maxPoints)}`;
    const categories = {
      fuel: ["fuel"],
      encounters: ["director", "arrival", "room"],
      player: [
        "strategy",
        "combat-summary",
        "burst",
        "potion",
        "health",
        "recovery",
        "progression",
        "result",
      ],
    };
    const entries = j.entries.filter(
      (e) => filter === "all" || categories[filter].includes(e.kind),
    );
    $("journalCount").textContent =
      `${entries.length} shown · ${j.totalEntries} total events. Export includes the full journal.`;
    const openEntries = new Set(
      [...document.querySelectorAll("#journal details[open]")].map(
        (e) => e.dataset.event,
      ),
    );
    const focusedEntry =
      document.activeElement?.closest("#journal details")?.dataset.event;
    $("journal").innerHTML = [...entries]
      .reverse()
      .map(
        (e) =>
          `<details data-event="${e.id}" ${openEntries.has(String(e.id)) ? "open" : ""} class="journal-entry event-${e.kind}"><summary><time>${time(e.time)}</time><span class="event-kind">${esc(e.kind)}</span><span>${esc(e.text)}</span></summary><small>${esc(e.context.roomName || e.context.room || "")}</small><pre>${esc(JSON.stringify(e.data, null, 2))}</pre></details>`,
      )
      .join("");
    if (focusedEntry)
      document
        .querySelector(`#journal [data-event="${focusedEntry}"] summary`)
        ?.focus({ preventScroll: true });
  };
}
