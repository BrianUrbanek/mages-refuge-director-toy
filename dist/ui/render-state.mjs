import { fmt, time } from "./format.mjs";
import { MENU_COLORS } from "./appearance.mjs";
import { createJournalView } from "./journal-view.mjs";
/** All DOM rendering consumes detached game read models. No simulation import. */
export function createRenderer(document) {
  const $ = (id) => document.getElementById(id),
    journalView = createJournalView(document);
  const glyph = (e) =>
    e.leader
      ? "◇"
      : e.tags.includes("support")
        ? "✧"
        : e.tags.includes("bruiser")
          ? "⬡"
          : e.tags.includes("ranged")
            ? "△"
            : "⋄";
  const portalStates = new Map(),
    markupCache = new Map();
  function setMarkup(id, html) {
    if (markupCache.get(id) !== html) {
      $(id).innerHTML = html;
      markupCache.set(id, html);
    }
  }
  function rosterRender(toy, roster) {
    const m = toy.rosterMenus[roster],
      c = m;
    $("rosterTabs").innerHTML = ["a", "b1", "b2", "c"]
      .map(
        (k) =>
          `<button class="${k === roster ? "active" : ""}" data-roster="${k}">${k === "a" ? "A · Ward Captain" : k === "b1" ? "B · Leechbreaker" : k === "b2" ? "B · Null Cantor" : "C · Mirror Marshal"}</button>`,
      )
      .join("");
    $("roster").innerHTML =
      `<h3 style="color:${MENU_COLORS[roster]}">${m.name}</h3><p>${m.identity}. ${m.required.length ? "Required: " + m.required.join(", ") + ". " : ""}Preferences: ${m.preferred.join(" → ")}.</p><div class="roster-grid">${c.enemies.map((e) => `<div class="enemy-row" style="--roster:${MENU_COLORS[roster]}"><i>${e.tier === "champion" ? "★" : glyph(e)}</i><div><b>${e.name}</b><small>${e.tier.toUpperCase()} · ${e.tags.join(" · ")}</small></div><em>${fmt(e.cost)} fuel</em></div>`).join("")}</div><div class="roster-note">Size follows resolved fuel cost · normal, Elite and Champion tiers · illustrative prototype content.</div>`;
  }
  function render(toy, { running, store }) {
    const p = toy.next,
      dead = toy.ended || toy.failed || toy.victoryReady;
    $("clock").textContent = time(toy.t);
    $("play").textContent = dead
      ? "Run complete"
      : running
        ? "Ⅱ Pause"
        : "▶ " + (toy.t ? "Resume" : "Begin assault");
    $("play").disabled = dead;
    $("runStatus").textContent = toy.failed
      ? "OVERWHELMED"
      : toy.ended || toy.victoryReady
        ? "COMPLETE"
        : running
          ? "ASSAULT ACTIVE"
          : "PAUSED";
    $("location").textContent =
      toy.areaDef.name +
      " · Chamber " +
      (toy.sub + 1) +
      " / " +
      toy.areaDef.parts.length;
    $("keyCount").textContent = `${store.keys} / 5`;
    $("sanctum").disabled = store.keys < 5 || !store.final || toy.sanctum;
    $("potential").textContent = fmt(toy.potential);
    $("available").textContent = fmt(toy.available);
    $("fuelTotal").textContent = fmt(toy.potential + toy.available);
    $("spent").textContent =
      `Spent ${fmt(toy.spent)} / introduced ${fmt(toy.added)}`;
    $("flow").textContent = `${toy.flow} fuel / sec`;
    $("hpText").textContent = `${Math.ceil(toy.hp)} / ${toy.maxHp}`;
    $("hpBar").style.width = (toy.hp / toy.maxHp) * 100 + "%";
    $("hpBar").style.background =
      toy.hp / toy.maxHp < 0.3 ? "#dd927b" : "#94bc92";
    $("powerText").textContent = toy.power;
    $("selectionMode").value = toy.selectionMode;
    $("selectionCards").textContent = toy.selectionList.cards
      .map(
        (c) =>
          `${c.kind === "normal" ? (c.target !== undefined ? "Normal " + c.target + " pts" : "Normal ×" + (c.targetMultiplier ?? 1)) : c.kind}${toy.director.selection?.excluded.includes(c.id) ? " (excluded)" : ""}`,
      )
      .join(" → ");
    $("selectionStatus").textContent =
      `Next draws: ${toy.selectionMode} · committed: ${toy.next?.selection?.kind ?? "final spend"} (${toy.next?.selection?.mode ?? "cleanup"}) · cycle ${toy.director.selection?.cycle ?? 0} · ${toy.director.selection?.remaining.length ?? 0} cards left`;
    $("enemyCount").textContent =
      `${toy.actors.length} defenders alive · ${toy.actors.filter((e) => e.originVolume && e.originVolume !== toy.current.id).length} pursuing from behind`;
    $("milestones").textContent =
      `${toy.volumes.filter((v) => v.state === "Finished").length} Finished`;
    $("portalHint").textContent =
      "Portal preference: " +
      (p?.portalPreferences.join(" → ") || "none") +
      " · " +
      toy.entrances
        .filter((e) => e.enabled !== false && (e.open || e.breachable))
        .map((e) => e.tags.join("/"))
        .join(", ") +
      " eligible";
    const visibleAreas = toy.areas.filter((a) =>
      toy.sanctum ? a.id === "liath" : a.id !== "liath",
    );
    setMarkup(
      "nodes",
      visibleAreas
        .map((a) => {
          const vs = toy.volumes.filter((v) => v.area === a.id),
            visited = vs.filter((v) => v.state !== "Untriggered").length,
            defeated =
              toy.lieutenants.includes(a.id) ||
              (a.id === "boss" && toy.finalDefeated);
          return `<div class="node ${a.kind === "optional" ? "optional" : ""} ${a.id === toy.area ? "current" : ""} ${defeated ? "defeated" : ""}" data-area="${a.id}"><b>${a.name}</b><span class="tiny">${defeated ? "DEFEATED" : visited ? visited + " / " + vs.length + " entered" : vs.length + " chambers"}</span></div>`;
        })
        .join(""),
    );
    $("localTitle").textContent = toy.current.name;
    $("zoneTitle").textContent =
      toy.areaDef.name +
      " · " +
      toy.zone.currentZone.budget.toFixed(0) +
      " points";
    const manual = toy.progression === "manual";
    document
      .querySelectorAll("[data-progression]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(b.dataset.progression === toy.progression),
        ),
      );
    $("routeChoice").value = toy.route;
    $("routeChoice").disabled = manual;
    $("approachNote").textContent = manual
      ? "Open each door yourself. Combat, fuel flow and recovery continue while you wait."
      : toy.approachDescription;
    $("hold").textContent = toy.hold ? "Resume approach" : "Stop advancing";
    $("hold").hidden = manual;
    $("hold").disabled = dead || toy.finalDefeated;
    setMarkup(
      "localNodes",
      toy.volumes
        .filter((v) => v.area === toy.area)
        .map(
          (v) =>
            `<div class="sub-node ${v.index === toy.sub ? "here" : ""} ${v.state !== "Untriggered" ? "visited" : ""}"><span class="sub-number">${v.index === toy.sub ? "✧" : v.index + 1}</span><b>${v.name}</b><small>${v.index === toy.sub ? "YOU ARE HERE" : v.state === "Untriggered" ? "Unvisited · release up to " + fmt(v.entryReleaseRequest) : "Entered · " + v.state}</small></div>`,
        )
        .join(""),
    );
    $("journeyStatus").textContent =
      !running && !dead
        ? manual
          ? "Simulation paused. Choose a door, then press Play to run combat."
          : toy.hold
            ? "Simulation paused; advancement is stopped. Play resumes combat, Resume approach resumes movement."
            : "Simulation paused. Press Play to run the selected approach."
        : toy.progressStatus;
    $("play").title = running
      ? "Pause everything: combat, fuel flow and recovery."
      : "Run simulation time; movement follows the selected progression mode.";
    $("hold").title =
      "Stop automatic movement only; combat, fuel flow and recovery continue.";
    const target = toy.actors.find((a) => a.id === toy.selected) || toy.target;
    $("targetLabel").textContent = target
      ? target.name + " · " + Math.ceil(target.hp) + " HP"
      : "No target";
    $("pressureCount").textContent = fmt(toy.livingCost) + " living points";
    $("pressureFill").style.width =
      Math.min(100, (toy.livingCost / 80) * 100) + "%";
    $("chargeText").textContent =
      "✦ " + toy.charges + " / " + toy.maxCharges + " charges";
    $("potionText").textContent =
      `Potions ${toy.potion.count} / ${toy.potion.capacity} · ` +
      (toy.potion.count === toy.potion.capacity
        ? "+40 HP below 50%"
        : `${fmt(toy.potion.progress)} / 30 fuel to refill`);
    $("chargeNote").textContent =
      toy.charges >= 2
        ? "Arrival burst ready · pulse ×4"
        : toy.charges === 1
          ? toy.maxCharges > 1 && toy.chargeProgress >= 8
            ? "Recharge imminent · burst ready"
            : "Reserved for 50% health · pulse ×4"
          : "Next charge in " + fmt(10 - toy.chargeProgress) + "s · pulse ×4";
    $("regenNote").textContent =
      `Regen: ${toy.playerStats.regen} in combat · ${toy.playerStats.regen * 5} while clear`;
    $("pressureDps").textContent =
      fmt(toy.incomingDps) +
      " incoming · " +
      fmt(toy.regeneration) +
      " regen HP / sec";
    $("combatBanner").textContent =
      toy.lastBanner && toy.t - toy.lastBanner.time < 4
        ? toy.lastBanner.name +
          " defeated · " +
          toy.earned +
          " Keystones earned"
        : "";
    toy.entrances.forEach((e) => {
      const el = $("entrance-" + e.slot),
        incoming =
          toy.dispatch?.entrance === e.id && toy.director.fundingEta !== 0,
        state = incoming ? "incoming" : e.open ? "open" : "sealed",
        prior = portalStates.get(e.id);
      if (prior === false && e.open) {
        el.classList.remove("just-opened");
        void el.offsetWidth;
        el.classList.add("just-opened");
      }
      portalStates.set(e.id, e.open);
      el.style.left = e.position.x * 100 + "%";
      el.style.top = e.position.y * 100 + "%";
      el.style.bottom = "auto";
      el.classList.toggle(
        "forecast-bright",
        incoming && Math.floor(toy.t / 0.18) % 2 === 0,
      );
      el.classList.toggle(
        "arriving",
        toy.effects.some(
          (f) =>
            f.type === "arrival" &&
            f.portalId === e.id &&
            toy.t - f.time < 0.35,
        ),
      );
      el.classList.toggle("blocked", !e.open);
      el.classList.toggle("warn", incoming);
      el.dataset.state = state;
      const eligible =
        e.enabled !== false && (e.open || e.breachable) && (!p || e.eligible);
      el.dataset.eligible = String(eligible);
      el.querySelector(".door-icon").src =
        "assets/icons/door-" + (e.open ? "open" : "closed") + ".svg";
      el.querySelector(".door-state").textContent = incoming
        ? toy.director.fundingEta === 0
          ? "Funded · awaiting engine"
          : "Incoming " +
            Math.max(0, toy.dispatch.until - toy.t).toFixed(1) +
            "s"
        : !e.open
          ? "Sealed"
          : eligible
            ? "Open"
            : "Open · busy";
      el.title =
        e.name +
        " · " +
        e.tags.join(", ") +
        " · " +
        (eligible ? "available for arrival" : "unavailable for arrival");
      el.setAttribute("aria-label", el.title);
    });
    $("warning").textContent = toy.dispatch
      ? `${toy.director.fundingEta === 0 ? "FUNDED · " + toy.wait.toUpperCase() : "PASSIVE ARRIVAL IN " + Math.max(0, toy.dispatch.until - toy.t).toFixed(1) + "s"} · ${toy.entrances.find((e) => e.id === toy.dispatch.entrance).name}`
      : toy.pending
        ? "TRIGGER PENDING · " + (toy.wait || "checking dispatch")
        : "";
    $("empty").style.display = toy.actors.length ? "none" : "block";
    $("empty").innerHTML = toy.ended
      ? "The Refuge yields.<small>Unused fuel was recorded. Only earned rewards were banked.</small>"
      : toy.failed
        ? "Pressure won this round.<small>Start a new run, rest before the next door, or invite less overlap.</small>"
        : toy.t === 0
          ? "The Refuge is waiting.<small>Begin the assault to see its finite opposition unfold.</small>"
          : toy.finalDefeated && toy.sweepComplete
            ? "Victory. Return to Traveler’s Rest.<small>The final budget was spent; sub-cheapest residue is recorded as unused.</small>"
            : toy.canSafe
              ? "A moment to breathe.<small>Residual fuel and the prepared group remain. Choose the next door.</small>"
              : "A lull is not a clear.<small>The Director is waiting for fuel, engine recovery, or a legal entrance.</small>";
    $("planId").textContent = p ? "#" + p.id : "—";
    $("planMenu").textContent = p
      ? toy.rosterMenus[p.menu].name
      : toy.ended
        ? "Activity ended"
        : toy.sweepComplete
          ? "Final spend complete"
          : "No prepared group";
    $("planMembers").innerHTML = p
      ? Object.entries(
          p.members.reduce(
            (n, e) => ((n[e.name] = (n[e.name] || 0) + 1), n),
            {},
          ),
        )
          .map(
            ([name, count]) => `<span class="member">${count}× ${name}</span>`,
          )
          .join("")
      : "";
    $("planCost").textContent = p ? fmt(p.cost) : "—";
    $("planTarget").textContent = p ? fmt(p.target) : "—";
    $("planCount").textContent = p ? p.members.length + " enemies" : "";
    $("waitStatus").textContent = toy.ended
      ? "Director stopped"
      : toy.failed
        ? "Simulation stopped"
        : toy.draining && toy.sweepComplete
          ? "Queue flushed · residue " + fmt(toy.available)
          : toy.director.waitReason === "engine-recovery"
            ? "Affordable · engine recovery " +
              fmt(toy.director.recoveryRemaining) +
              "s"
            : toy.dispatch && toy.director.fundingEta !== 0
              ? "Anticipating passive funding"
              : toy.wait || "Ready";
    $("cooldown").textContent = !p
      ? "—"
      : toy.director.fundingEta === 0
        ? "Funded"
        : toy.director.fundingEta === null
          ? "No further passive funding"
          : fmt(toy.director.fundingEta) + "s";
    $("trace").textContent = p
      ? "Portal preference: " +
        p.portalPreferences.join(" → ") +
        ". " +
        p.trace.join(" → ") +
        (p.standalone
          ? " Standalone authored group; no padding."
          : p.core < 0
            ? " Affordable ad hoc final spend."
            : `. Core ${p.core + 1}. All required tags covered. Average-cost and member limits applied.`)
      : "";
    $("decisionTitle").textContent = toy.finalDefeated
      ? "The final fight is won."
      : toy.lastSub
        ? manual
          ? "Choose your next route"
          : "Next: " +
            (toy.areas.find((a) => a.id === toy.routeNext)?.name ||
              "checkpoint")
        : "Next: " + toy.areaDef.parts[toy.sub + 1][0];
    $("decisionText").textContent = toy.ended
      ? `${toy.kills} enemies defeated · ${toy.breaches} early breaches · peak crowd ${toy.peakCrowd} · ${toy.earned} Keystones earned.`
      : toy.draining
        ? "Boss final spend" +
          ". Final spend uses affordable packs and ad hoc units. Surviving defenders remain active."
        : "Manual opens doors directly. Automatic modes follow your chosen pace and route; stopping advancement leaves combat and recovery running.";
    const choices = manual && toy.lastSub ? toy.destinations : [];
    setMarkup(
      "doors",
      choices
        .map(
          (id) =>
            `<button class="primary destination" data-advance="${id}" ${dead || !toy.gateReady ? "disabled" : ""}>${toy.areas.find((a) => a.id === id).name} →</button>`,
        )
        .join(""),
    );
    const extras = manual ? (toy.lastSub ? choices : [null]) : [];
    setMarkup(
      "alternateDoors",
      extras
        .map(
          (id) =>
            `<div class="door-row"><span>${id ? toy.areas.find((a) => a.id === id).name : "Next chamber"}</span><div><button data-breach="${id || ""}" ${dead || !toy.gateReady ? "disabled" : ""}>Shatter crystal</button>${toy.lastSub && toy.area !== "entry" ? `<button data-guardian="${id}" ${dead || !toy.gateReady || toy.guardianAreas.includes(toy.area) ? "disabled" : ""}>Guardian</button>` : ""}</div></div>`,
        )
        .join(""),
    );
    $("bossExclude").disabled =
      toy.bossExcluded ||
      toy.sanctum ||
      dead ||
      toy.volumes.find((v) => v.area === "boss" && v.index === 3)?.state !==
        "Untriggered";
    $("return").disabled =
      !toy.finalDefeated || !toy.sweepComplete || toy.ended;
    $("chest").textContent = toy.chestApplied
      ? "Chest accepted"
      : "Accept additional chest · +24 fuel";
    $("chest").disabled = toy.chestApplied || toy.draining || dead;
    $("progress").disabled = dead || (toy.lastSub && !toy.gateReady);
    $("progress").hidden = !manual || toy.lastSub || toy.finalDefeated;
    $("newRefuge").hidden = !toy.sanctum;
    $("progress").textContent = toy.lastSub
      ? "Choose your next route"
      : "Open next door →";
    $("progress").title = toy.lastSub
      ? "Choose the next zone"
      : "Proceed to " + toy.areaDef.parts[toy.sub + 1][0];
    $("return").hidden = !toy.finalDefeated;
    $("releaseHere").disabled =
      dead || toy.draining || toy.sourcePotential < 0.001;
    setMarkup(
      "routes",
      toy.entrances
        .map(
          (e) =>
            `<button data-route="${e.id}" class="${e.enabled !== false ? "active" : ""}">${e.name} · ${e.tags.join(", ")} ${e.enabled !== false ? "✓" : "×"}</button>`,
        )
        .join(""),
    );
    journalView(toy);
    $("resultsButton").hidden = !dead;
    const h = toy.history,
      max = Math.max(15, ...h.map((p) => p.n));
    $("chartPath").setAttribute(
      "d",
      h
        .map(
          (p, i) =>
            `${i ? "L" : "M"} ${(i / Math.max(1, h.length - 1)) * 300} ${70 - (p.n / max) * 60}`,
        )
        .join(" "),
    );
  }

  let rosterKey = "";
  return {
    render,
    renderRoster: (toy, roster) => {
      const key = roster + toy.depth + toy.personality;
      if (key !== rosterKey) {
        rosterRender(toy, roster);
        rosterKey = key;
      }
    },
    reset: () => {
      portalStates.clear();
      markupCache.clear();
      rosterKey = "";
    },
  };
}
