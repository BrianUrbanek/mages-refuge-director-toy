import { SeededRandom } from "../core/seeded-random.mjs";
/** Independent host stream; encounter list owns a separate seeded instance. */
export function createRandom(seed) {
  const random = new SeededRandom(seed);
  return () => random.next();
}
