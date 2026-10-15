/** Current entry points. Versioned filenames remain active; history is not run. */
export const CHECK_SUITES = Object.freeze([
  {
    file: "core-tests.mjs",
    scope: "director",
    coverage: "shared scheduler + legacy/default compatibility",
  },
  {
    file: "core-component-tests.mjs",
    scope: "director",
    coverage: "core ownership, provenance and hard constraints",
  },
  {
    file: "selection-tests.mjs",
    scope: "director",
    coverage: "selector rules + legacy/default manager compatibility",
  },
  {
    file: "budget-tests.mjs",
    scope: "director",
    coverage: "current budget-aware composition and scheduling",
  },
  {
    file: "verify-v5.mjs",
    scope: "host",
    coverage: "combat contracts + seeded playthrough probes",
  },
  {
    file: "verify-v7.mjs",
    scope: "host",
    coverage: "progression commands and reset",
  },
  {
    file: "verify-v8.mjs",
    scope: "host",
    coverage: "engine guard and portal-origin display contract",
  },
  {
    file: "verify-v9.mjs",
    scope: "host",
    coverage: "architecture, finite fuel and telemetry",
  },
  {
    file: "verify-v10.mjs",
    scope: "host",
    coverage: "approaches and quiet recovery",
  },
  {
    file: "verify-v11.mjs",
    scope: "host",
    coverage: "potions + seeded baseline observations",
  },
  {
    file: "verify-v12.mjs",
    scope: "host",
    coverage: "stepped stats and resource scaling",
  },
  {
    file: "verify-v13.mjs",
    scope: "host",
    coverage: "authored decks, seal execution and deterministic runs",
  },
  {
    file: "verify-v14.mjs",
    scope: "host",
    coverage: "six-second warning veto and concise combat Journal",
  },
  {
    file: "verify-v15.mjs",
    scope: "host",
    coverage: "arrival/recharge bursts and Steady reserves",
  },
  {
    file: "verify-v16.mjs",
    scope: "host",
    coverage: "burst strategies, support screen and current boss stats",
  },
  {
    file: "verify-v17.mjs",
    scope: "host",
    coverage: "current targeting and boss clock/host integration",
  },
  {
    file: "verify-v18.mjs",
    scope: "host",
    coverage: "detached scene metadata and six-second warning boundaries",
  },
  {
    file: "verify-v19.mjs",
    scope: "host",
    coverage: "ordered arena replay, departure, effect geometry and instant deaths",
  },
  {
    file: "director-conformance.mjs",
    scope: "director",
    coverage: "retained legacy/default portable golden vectors",
  },
]);
