import { APP_VERSION } from "../version.mjs";
const releases = [
  [
    18,
    "Finding your way",
    [
      "The Traveler exits through the Front gate and returns through the Rear arch when moving rooms.",
      "Distinct barracks, mirror-hall and inner-sanctum backgrounds mark different floors.",
      "The version label now opens patch notes. Visual travel never delays fuel or combat.",
    ],
  ],
  [
    17,
    "Bosses and final groups",
    [
      "Lowest-HP targeting and spill, with supports drawing fire first.",
      "Final groups absorb small budget tails; bosses no longer flush remaining fuel.",
      "Bosses arrive on zone countdowns, even when you wait in the first room.",
      "Bosses use 20-point tuning with a gold halo; their arrivals appear in the Journal.",
    ],
  ],
  [
    16,
    "Charge strategies",
    [
      "Choose when to spend your last charge: health, crowd pressure, or priority targets.",
      "Supports absorb attacks before other enemies.",
    ],
  ],
  [
    15,
    "Player reserves",
    [
      "Spend surplus charges immediately and avoid wasting imminent recharge.",
      "Slow and steady accepts 70% health with two charges, or full health with one.",
    ],
  ],
  [
    14,
    "Warnings and readable runs",
    [
      "Six-second passive arrival forecasts; Slow and steady and Press forward stay for active warnings.",
      "One summary per continuous combat and Copy log for sharing.",
    ],
  ],
  [
    13,
    "Encounter decks",
    [
      "Ordered lists or seeded draws without replacement shape each personality.",
      "Small standalone breach groups can open sealed side doors without warning.",
    ],
  ],
  [
    12,
    "Player power",
    ["Stepped player-stat controls and a visible optional-pressure chest."],
  ],
  [
    11,
    "Potions",
    [
      "Automatic healing potions recharge from defeated enemies; scripted leaders refill them.",
    ],
  ],
];
export function mountReleaseNotes(document) {
  const button = document.getElementById("versionNotes"),
    dialog = document.getElementById("patchNotes");
  button.textContent = "V" + APP_VERSION;
  const list = document.getElementById("patchNotesList");
  for (const [version, title, notes] of releases) {
    const details = document.createElement("details"),
      summary = document.createElement("summary"),
      ul = document.createElement("ul");
    details.open = version === APP_VERSION;
    summary.textContent = `V${version} · ${title}`;
    for (const note of notes) {
      const li = document.createElement("li");
      li.textContent = note;
      ul.append(li);
    }
    details.append(summary, ul);
    list.append(details);
  }
  button.onclick = () => dialog.showModal();
  document.getElementById("closePatchNotes").onclick = () => dialog.close();
}
