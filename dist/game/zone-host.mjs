/** Demo level adapter: rooms, zone activation and physical portal meaning never enter the ED. */
import { BossClock } from "./boss-clock.mjs";
export class ZoneHost {
  constructor(areas, depth = 1, bossTiming = {}) {
    const scale = 1 + 0.12 * (depth - 1);
    this.scale = scale;
    this.zones = areas.map((a) => ({
      ...structuredClone(a),
      activated: false,
      bossClock: new BossClock(bossTiming),
      budget: a.budget * scale,
      rooms: a.parts.map(([name, entryReleaseRequest], index) => ({
        id: a.id + ":" + index,
        area: a.id,
        index,
        name,
        entryReleaseRequest: entryReleaseRequest * scale,
        state: "Untriggered",
        triggeredAt: null,
        finishedAt: null,
      })),
    }));
    this.currentZone = null;
    this.portals = [];
  }
  get rooms() {
    return this.zones.flatMap((z) => z.rooms);
  }
  enter(area, index, manager, config, cause, time) {
    const z = this.zones.find((z) => z.id === area),
      room = z?.rooms[index];
    if (!room || room.state !== "Untriggered") return false;
    if (!z.activated) {
      manager.cancelDispatch("Zone changed");
      manager.applyOnce("zone:" + z.id, { add: z.budget });
      z.activated = true;
      this.currentZone = z;
      this.portals = [
        {
          id: z.id + "/rear",
          slot: "rear",
          position: { x: 0.14, y: 0.7 },
          name: "Rear arch",
          tags: ["behind"],
          open: true,
        },
        {
          id: z.id + "/front",
          slot: "front",
          position: { x: 0.86, y: 0.7 },
          name: "Front gate",
          tags: ["forward"],
          open: true,
        },
        {
          id: z.id + "/side",
          slot: "side",
          position: { x: 0.5, y: 0.1 },
          name: "Side breach",
          tags: ["side-sealed", "breachable"],
          open: false,
          breachable: true,
          enabled: true,
        },
        {
          id: z.id + "/sealed",
          slot: "sealed",
          position: { x: 0.5, y: 0.9 },
          name: "Sealed side door",
          tags: ["side-sealed", "breachable"],
          open: false,
          breachable: true,
          enabled: true,
        },
      ];
    }
    room.state = "Triggered";
    room.triggeredAt = time;
    room.cause = cause;
    // Side seals persist until a Director-assigned breach arrives.
    // Entry requests a portion of this zone's budget, capped by its remaining Potential.
    // It never examines the prepared group, tops up a shortfall, or creates fuel.
    room.released = manager.transfer(
      room.entryReleaseRequest,
      "zone:" + z.id,
      "room-entry",
    );
    manager.updatePortals(this.descriptors());
    manager.updateConfig(config);
    manager.requestSpawn();
    return true;
  }
  descriptors() {
    return this.portals.map((p) => ({
      id: p.id,
      tags: [...p.tags],
      eligible: p.enabled !== false && (p.open || p.breachable === true),
      breachable: p.breachable === true && !p.open,
    }));
  }
  toggle(id) {
    const p = this.portals.find((p) => p.id === id);
    if (p) p.enabled = p.enabled === false;
    return p;
  }
  breach(id) {
    const p = this.portals.find((p) => p.id === id);
    if (!p || !p.breachable || p.open) return false;
    p.open = true;
    p.breachable = false;
    p.tags = ["side-open"];
    return true;
  }
  observeQuiet(manager, time) {
    const status = manager.snapshot();
    if (
      status.dispatch ||
      status.error ||
      status.livingOpposition ||
      (!status.next && !status.finalComplete && !status.budgetComplete)
    )
      return;
    if (
      !status.finalComplete &&
      !status.budgetComplete &&
      status.potential + status.available + 1e-7 >= status.next.cost
    )
      return;
    for (const r of this.rooms)
      if (r.state === "Triggered") {
        r.state = "Finished";
        r.finishedAt = time;
      }
  }
  snapshot() {
    return structuredClone({
      zones: this.zones.map((z) => ({
        ...z,
        bossClock: z.bossClock.snapshot(),
      })),
      portals: this.portals,
    });
  }
}
