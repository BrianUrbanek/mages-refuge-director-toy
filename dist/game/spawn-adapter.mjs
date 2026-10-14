/** Zone host materializes designated units at designated portal anchors. */
export function createSpawnAdapter(scene) {
  return {
    assetsReady: () => true,
    canEnter: (p, id) => scene.canEnter(p, id),
    commitSpawn: (p, id) => {
      if (!scene.canEnter(p, id)) return { success: false };
      const ids = p.members.map((m) => {
        const actorId = ++scene.serial;
        const hp = m.cost * 22;
        scene.pendingActors.set(actorId, {
          ...m,
          id: actorId,
          maxHp: hp,
          hp,
          menu: p.menu,
          leader: false,
          originVolume: scene.current().id,
          entrance: scene.entrances.find((e) => e.id === id).slot,
          originPortal: id,
          position: scene.spawnPosition(
            scene.entrances.find((e) => e.id === id).slot,
          ),
          spawnPoint: scene.spawnPosition(
            scene.entrances.find((e) => e.id === id).slot,
          ),
          age: 0,
        });
        return actorId;
      });
      if (p.intent === "breach") scene.zone.breach(id);
      return {
        success: true,
        actorIds: ids,
        portals: scene.zone.descriptors(),
      };
    },
  };
}
export function canSpawnAtPortal(scene, plan, id) {
  const e = scene.entrances.find((e) => e.id === id);
  return (
    !!e &&
    e.enabled !== false &&
    (e.open ||
      (plan.intent === "breach" && plan.portalId === id && e.breachable)) &&
    scene.actors
      .filter((a) => !a.leader && a.originPortal === id && a.age < 1.2)
      .reduce((n, a) => n + a.footprint, 0) +
      plan.members.reduce((n, a) => n + a.footprint, 0) <=
      75
  );
}
