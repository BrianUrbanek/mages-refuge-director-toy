import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { CHECK_SUITES } from "./check-suites.mjs";
const root = path.dirname(fileURLToPath(import.meta.url));
function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
  });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  return (result.stdout.match(/^PASS /gm) ?? []).length;
}
export function runCheckSuites({ directorOnly = false } = {}) {
  let checks = 0;
  for (const suite of CHECK_SUITES.filter(
    (s) => !directorOnly || s.scope === "director",
  )) {
    console.log(`SUITE ${suite.file} · ${suite.coverage}`);
    const count = run([suite.file]);
    if (!count)
      throw new Error(`Suite reported no passing cases: ${suite.file}`);
    checks += count;
  }
  function syntax(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) syntax(file);
      else if (entry.name.endsWith(".mjs")) run(["--check", file]);
    }
  }
  syntax(path.join(root, directorOnly ? "dist/core" : "dist"));
  console.log(
    `${checks} ${directorOnly ? "independent Director" : "current"} checks and module syntax checks passed.`,
  );
}
