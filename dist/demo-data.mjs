import {
  personalitySelection,
  breachGroups,
} from "./game/director-profiles.mjs";
export const MENUS = {
  ward: {
    name: "Refuge Ward",
    identity: "Generalist • balanced opening assault",
    required: [],
    preferred: ["melee", "ranged"],
    enemies: [
      ["sentry", "Arcane Sentry", 4, ["melee"], 1],
      ["bolt", "Prison Boltweaver", 6, ["ranged"], 1],
      ["keeper", "Ward Keeper", 8, ["support"], 1.3],
      ["guard", "Crystal Guardian", 10, ["bruiser", "melee"], 1.5],
    ],
    cores: [
      [0, 0, 1],
      [0, 2],
      [3, 0],
      [1, 1],
    ],
  },
  a: {
    name: "Veyra, the Ward Captain",
    identity: "Group A • generalist / disciplined mixed ranks",
    required: [],
    preferred: ["melee", "bruiser"],
    enemies: [
      ["blade", "Covenant Bladesman", 4, ["melee"], 1],
      ["bow", "Runebolt Marksman", 6, ["ranged"], 1],
      ["banner", "Banner Channeler", 7, ["support"], 1.2],
      ["bulwark", "Runic Bulwark", 10, ["melee", "bruiser"], 1.5],
    ],
    cores: [
      [0, 0, 1],
      [0, 2],
      [3, 0],
      [1, 1],
    ],
  },
  b1: {
    name: "Orren, the Leechbreaker",
    identity: "Group B • optional / anti-leech specialists",
    required: ["anti-leech"],
    preferred: ["melee", "bruiser", "slow"],
    enemies: [
      ["thrall", "Hollow Thrall", 3, ["melee"], 0.8],
      ["suppressor", "Leech Suppressor", 7, ["anti-leech", "ranged"], 1],
      [
        "brute",
        "Leechbreaker Brute",
        9,
        ["anti-leech", "bruiser", "melee"],
        1.5,
      ],
      ["siege", "Siege Bruiser", 8, ["bruiser", "melee"], 1.3],
      ["anchor", "Soul Anchor", 6, ["support", "slow"], 1],
    ],
    cores: [
      [0, 0, 0],
      [3, 0],
      [2, 0],
      [1, 4],
    ],
    local: [
      ["support", 1],
      ["ranged", -1],
    ],
  },
  b2: {
    name: "Silex, the Null Cantor",
    identity: "Group B • optional / silence and control",
    required: ["silence"],
    preferred: ["control", "ranged"],
    enemies: [
      ["wisp", "Mute Wisp", 3, ["ranged"], 0.7],
      ["cantor", "Null Cantor", 7, ["silence", "control", "ranged"], 1],
      ["gaoler", "Spell Gaoler", 9, ["silence", "melee", "bruiser"], 1.4],
      ["weaver", "Binding Weaver", 6, ["control", "support"], 1],
      ["hound", "Prison Hound", 4, ["melee", "fast"], 0.9],
    ],
    cores: [
      [0, 0, 4],
      [2, 4],
      [1, 3],
      [4, 4, 4],
    ],
    local: [["support", 1]],
  },
  c: {
    name: "Ilyss, the Mirror Marshal",
    identity: "Group C • generalist / moderate mirror mechanics",
    required: ["mirror"],
    preferred: ["ranged", "melee"],
    enemies: [
      ["mirror", "Mirror Adept", 6, ["mirror", "ranged"], 1],
      ["duelist", "Glass Duelist", 4, ["melee"], 1],
      ["prism", "Prism Warden", 9, ["mirror", "bruiser", "melee"], 1.4],
      ["mender", "Echo Mender", 7, ["support"], 1],
      ["shade", "Reflected Shade", 3, ["ranged"], 0.8],
    ],
    cores: [
      [0, 1, 1],
      [2, 1],
      [3, 4],
      [4, 4, 1],
    ],
  },
  boss: {
    name: "Final Generalist",
    identity: "Final boss • mixed Covenant guard",
    required: [],
    preferred: ["bruiser", "ranged"],
    enemies: [
      ["elite", "Sanctum Sentinel", 9, ["bruiser", "melee"], 1.4],
      ["magus", "Covenant Magus", 6, ["ranged"], 1],
      ["acolyte", "Bound Acolyte", 3, ["melee"], 0.8],
      ["restorer", "Soul Restorer", 7, ["support"], 1.1],
    ],
    cores: [
      [0, 2],
      [1, 1, 2],
      [2, 2, 3],
      [0, 1],
    ],
  },
  liath: {
    name: "The Maker · Liath",
    identity: "Separate Sanctum • mechanic families in short windows",
    required: ["control"],
    preferred: ["mirror", "bruiser"],
    enemies: [
      ["judge", "Artificial Sentinel", 9, ["control", "bruiser", "melee"], 1.3],
      ["echo", "Temporal Echo", 6, ["mirror", "ranged"], 1],
      ["thread", "Soul Thread", 3, ["melee"], 0.8],
      ["null", "Null Construct", 7, ["control", "silence"], 1],
    ],
    cores: [
      [0, 2],
      [1, 2, 2],
      [3, 2],
      [0, 1],
    ],
  },
};
export const AREAS = [
  {
    id: "entry",
    name: "Beacon Hall",
    menu: "ward",
    kind: "tutorial",
    budget: 100,
    flowRate: 0.5,
    parts: [
      ["Beacon Landing", 25],
      ["Sentry Passage", 25],
      ["Resonance Gallery", 25],
      ["First Crystal", 25],
    ],
    x: 10,
    y: 64,
  },
  {
    id: "a",
    name: "Ward Captain",
    menu: "a",
    kind: "required",
    budget: 100,
    flowRate: 0.5,
    parts: [
      ["Outer Barracks", 25],
      ["Muster Corridor", 25],
      ["Ward Engine", 25],
      ["Captain’s Chamber", 25],
    ],
    x: 30,
    y: 64,
  },
  {
    id: "b1",
    name: "Leechbreaker",
    menu: "b1",
    kind: "optional",
    budget: 100,
    flowRate: 0.5,
    parts: [
      ["Hollow Cells", 25],
      ["Soul Conduits", 25],
      ["Anchor Vault", 25],
      ["Leechbreaker’s Court", 25],
    ],
    x: 43,
    y: 22,
  },
  {
    id: "b2",
    name: "Null Cantor",
    menu: "b2",
    kind: "optional",
    budget: 100,
    flowRate: 0.5,
    parts: [
      ["Silent Passage", 25],
      ["Binding Gallery", 25],
      ["Gaoler Hall", 25],
      ["Null Choir", 25],
    ],
    x: 66,
    y: 22,
  },
  {
    id: "c",
    name: "Mirror Marshal",
    menu: "c",
    kind: "required",
    budget: 100,
    flowRate: 0.5,
    parts: [
      ["Glass Vestibule", 25],
      ["Reflection Hall", 25],
      ["Echo Engine", 25],
      ["Marshal’s Chamber", 25],
    ],
    x: 70,
    y: 64,
  },
  {
    id: "boss",
    name: "Inner Refuge",
    menu: "boss",
    kind: "final",
    budget: 100,
    flowRate: 0.5,
    parts: [
      ["Inner Approach", 25],
      ["Sealed Gallery", 25],
      ["General’s Guard", 25],
      ["Final Chamber", 25],
    ],
    x: 90,
    y: 64,
  },
  {
    id: "liath",
    name: "Mage Sanctum",
    menu: "liath",
    kind: "sanctum",
    budget: 100,
    flowRate: 0.5,
    parts: [
      ["Soul Threshold", 25],
      ["Artifice Hall", 25],
      ["Temporal Gallery", 25],
      ["The Maker’s Chamber", 25],
    ],
    x: 50,
    y: 64,
  },
];
export const APPROACHES = {
  steady: {
    name: "Slow and steady",
    description:
      "Clear all enemies, then wait for at least 80% health and full DPS charges.",
    dwell: 0,
  },
  press: {
    name: "Press forward",
    description:
      "Advance as soon as all enemies are cleared, regardless of health or charges.",
    dwell: 0,
  },
  charge: {
    name: "Charge ahead",
    description: "Shatter crystals early; invite overlap and pursuit.",
    dwell: 2,
  },
};

export const BOSSES = [
  "Arkos · the Storm General",
  "Thessa · the Bound General",
  "Mordane · the Iron General",
];
export function configFor(
  menu,
  personality = "balanced",
  depth = 1,
  stage = 0,
  selectionMode = "random",
) {
  const m = MENUS[menu],
    scale = 1 + 0.12 * (depth - 1);
  const enemies = m.enemies.map(([id, name, oldCost, tags], i) => ({
    id: menu + "-" + id,
    name,
    cost:
      (i === 0
        ? 0.6
        : tags.includes("bruiser")
          ? 5
          : tags.includes("support")
            ? 2.4
            : 1.2) * scale,
    tags: [...tags],
    tier: tags.includes("bruiser") ? "elite" : "normal",
    footprint: tags.includes("bruiser") ? 2 : 1,
  }));
  enemies.push({
    id: menu + "-fodder",
    name: m.name.split(",")[0] + " Retainer",
    cost: 0.45 * scale,
    tags: ["melee", "fodder"],
    tier: "normal",
    footprint: 1,
  });
  enemies.push({
    id: menu + "-champion",
    name: m.name.split(",")[0] + " Champion",
    cost: 10 * scale,
    tags: ["melee", "bruiser", "champion"],
    tier: "champion",
    footprint: 3,
  });
  const cores = m.cores.map((core) => [
    ...core.map((i) => enemies[i].id),
    ...Array(8).fill(enemies.at(-2).id),
  ]);
  cores.push([enemies.at(-1).id, enemies[0].id, enemies[0].id]);
  const targets = {
    balanced: [18, 20, 22, 25],
    heavy: [25, 30, 35, 40],
    swarm: [15, 18, 20, 22],
    crescendo: [15, 20, 25, 35],
    wave: [15, 25, 20, 30],
  };
  return {
    id: menu + "-" + personality + "-d" + depth + "-s" + stage,
    menu,
    enemies,
    groups: breachGroups(menu, enemies, scale),
    selection: personalitySelection(personality, selectionMode, scale),
    cores,
    required: m.required,
    preferred: m.preferred,
    local: m.local || [],
    targets: [targets[personality][Math.min(3, stage)] * scale],
    finalTarget: 32 * scale,
    flowRate: AREAS.find((a) => a.menu === menu).flowRate,
    portalPreferences: {
      balanced: ["forward", "side-open"],
      heavy: ["side-sealed", "forward"],
      swarm: ["behind", "side-open"],
      crescendo: ["forward", "behind"],
      wave: ["side-open", "behind"],
    }[personality],
    corePortalPreferences: { [cores.length - 1]: ["side-sealed", "forward"] },
    rules: { maxMembers: 32, maxChampions: 2, maxAverageCost: 1.8 * scale },
  };
}
