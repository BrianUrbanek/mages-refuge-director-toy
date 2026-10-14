/** Portable uint32 LCG. Separate instances keep host and selector streams independent. */
export class SeededRandom {
  #state;
  constructor(seed = 1) {
    if (!Number.isSafeInteger(seed)) throw new Error("Invalid random seed");
    this.#state = seed >>> 0;
  }
  get state() {
    return this.#state;
  }
  next() {
    this.#state = (Math.imul(1664525, this.#state) + 1013904223) >>> 0;
    return this.#state / 4294967296;
  }
  index(length) {
    if (!Number.isSafeInteger(length) || length < 1)
      throw new Error("Invalid draw count");
    return Math.floor(this.next() * length);
  }
}
