/** Presentation only. Receives detached snapshots; never imports or mutates the encounter manager. */
export class CrowdView {
  constructor(canvas, onSelect, { colorForActor = () => "#83b9c4" } = {}) {
    this.colorForActor = colorForActor;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.positions = new Map();
    this.ghosts = [];
    this.lastActors = new Map();
    this.onSelect = onSelect;
    this.snapshot = null;
    this.showNumbers = false;
    this.canvas.onclick = (e) => {
      const r = this.canvas.getBoundingClientRect(),
        x = (e.clientX - r.left) / r.width,
        y = (e.clientY - r.top) / r.height;
      let best = null,
        distance = 0.06;
      for (const [id, p] of this.positions) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < distance) {
          best = id;
          distance = d;
        }
      }
      if (best) this.onSelect(best);
    };
  }
  reset() {
    this.positions.clear();
    this.ghosts = [];
    this.lastActors.clear();
    this.snapshot = null;
  }
  render(snapshot, dt) {
    this.snapshot = snapshot;
    const c = this.canvas,
      r = c.getBoundingClientRect(),
      ratio = window.devicePixelRatio || 1;
    if (
      c.width !== Math.round(r.width * ratio) ||
      c.height !== Math.round(r.height * ratio)
    ) {
      c.width = Math.round(r.width * ratio);
      c.height = Math.round(r.height * ratio);
    }
    const ctx = this.ctx,
      w = r.width,
      h = r.height;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const living = new Set(snapshot.actors.map((a) => a.id));
    for (const id of this.positions.keys())
      if (!living.has(id)) {
        this.ghosts.push({
          position: { ...this.positions.get(id) },
          actor: this.lastActors.get(id),
          time: snapshot.time,
        });
        this.positions.delete(id);
      }
    this.lastActors = new Map(snapshot.actors.map((a) => [a.id, a]));
    this.ghosts = this.ghosts.filter(
      (g) => snapshot.time >= g.time && snapshot.time - g.time < 0.35,
    );
    for (const g of this.ghosts) {
      if (!g.actor) continue;
      const age = (snapshot.time - g.time) / 0.35,
        size = 12 * (1 + age);
      ctx.globalAlpha = 1 - age;
      ctx.fillStyle = this.colorForActor(g.actor);
      ctx.fillRect(
        g.position.x * w - size / 2,
        g.position.y * h - size / 2,
        size,
        size,
      );
      ctx.globalAlpha = 1;
    }
    for (const a of snapshot.actors) {
      const t = Math.min(1, a.age / 0.6),
        start = a.spawnPoint ?? a.position;
      this.positions.set(a.id, {
        x: start.x + (a.position.x - start.x) * t,
        y: start.y + (a.position.y - start.y) * t,
      });
    }
    // Soft separation creates a scrum without modifying combat or logical spawn safety.
    const items = [...this.positions];
    for (let i = 0; i < items.length; i++)
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i][1],
          b = items[j][1],
          dx = b.x - a.x,
          dy = b.y - a.y,
          d = Math.hypot(dx, dy);
        if (d > 0 && d < 0.025) {
          const f = (0.025 - d) * 0.08;
          a.x -= (dx / d) * f;
          a.y -= (dy / d) * f;
          b.x += (dx / d) * f;
          b.y += (dy / d) * f;
        }
      }
    for (const a of snapshot.actors) {
      const p = this.positions.get(a.id),
        size = 24 * Math.max(0.5, Math.min(2, Math.sqrt(a.cost / 2.5))),
        x = p.x * w,
        y = p.y * h;
      const recent = snapshot.effects.some(
        (e) =>
          e.type === "hit" &&
          e.actorId === a.id &&
          snapshot.time - e.time < 0.12,
      );
      // Scripted leaders stand out even when their point-scaled block is smaller.
      // This is purely visual: the halo has no combat or Director effects.
      if (a.leader && !a.key?.startsWith("guardian-")) {
        const pulse = 0.5 + 0.5 * Math.sin(snapshot.time * 2.4),
          radius = size * (1.1 + pulse * 0.12),
          halo = ctx.createRadialGradient(x, y, size * 0.3, x, y, radius);
        halo.addColorStop(0, "rgba(255, 210, 120, 0.30)");
        halo.addColorStop(0.55, "rgba(255, 184, 80, 0.16)");
        halo.addColorStop(1, "rgba(255, 184, 80, 0)");
        ctx.save();
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 224, 160, ${0.45 + pulse * 0.2})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.82 + pulse * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.translate(x, y);
      if (a.tags.includes("ranged")) ctx.rotate(Math.PI / 4);
      ctx.fillStyle = recent ? "#fff5d4" : this.colorForActor(a) + "cc";
      ctx.strokeStyle =
        a.tier === "champion" ? "#ffe3a8" : this.colorForActor(a);
      ctx.lineWidth = a.tier === "champion" ? 3 : a.tier === "elite" ? 2 : 1;
      ctx.shadowColor = this.colorForActor(a);
      ctx.shadowBlur = a.leader ? 15 : 0;
      ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.strokeRect(-size / 2, -size / 2, size, size);
      ctx.restore();
      if (a.tier !== "normal") {
        ctx.strokeStyle = "#fce5b5";
        ctx.lineWidth = 1;
        ctx.strokeRect(x - size / 2 - 4, y - size / 2 - 4, size + 8, size + 8);
      }
      ctx.fillStyle = "#102224";
      ctx.font = `bold ${Math.max(9, size * 0.45)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(
        a.leader
          ? "◆"
          : a.tags.includes("support")
            ? "+"
            : a.tier === "champion"
              ? "★"
              : a.tier === "elite"
                ? "■"
                : "",
        x,
        y + 4,
      );
      ctx.fillStyle = "#24352e";
      ctx.fillRect(x - size / 2, y - size / 2 - 7, size, 3);
      ctx.fillStyle = recent ? "#fff" : this.colorForActor(a);
      ctx.fillRect(
        x - size / 2,
        y - size / 2 - 7,
        size * Math.max(0, a.hp / a.maxHp),
        3,
      );
      if (a.id === snapshot.selected) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.8 + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    for (const e of snapshot.effects) {
      const age = snapshot.time - e.time;
      if (e.type === "attack" && age < 0.25) {
        ctx.strokeStyle = e.boosted ? "#8cecf2" : "#fce2a6";
        ctx.lineWidth = e.boosted ? 3 : 2;
        ctx.globalAlpha = 1 - age / 0.25;
        ctx.beginPath();
        ctx.moveTo(e.from.x * w, e.from.y * h);
        ctx.lineTo(e.to.x * w, e.to.y * h);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (e.type === "burst" && age < 0.8) {
        ctx.strokeStyle = "#8cecf2";
        ctx.lineWidth = 3;
        ctx.globalAlpha = 1 - age / 0.8;
        ctx.beginPath();
        ctx.arc(w * 0.5, h * 0.57, age * w * 0.48, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (e.type === "recover" && age < 1) {
        ctx.strokeStyle = "#a3e6ae";
        ctx.globalAlpha = 1 - age;
        ctx.beginPath();
        ctx.arc(w * 0.5, h * 0.57, 25 + age * 35, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (this.showNumbers && e.type === "hit" && age < 0.65) {
        const p = this.positions.get(e.actorId);
        if (p) {
          ctx.fillStyle = "#fff6da";
          ctx.font = "11px sans-serif";
          ctx.globalAlpha = 1 - age / 0.65;
          ctx.fillText(Math.round(e.damage), p.x * w, p.y * h - age * 35);
          ctx.globalAlpha = 1;
        }
      }
    }
  }
}
