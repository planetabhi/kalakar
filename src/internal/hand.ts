/** The artist's unsteady hand: a seeded, deterministic pseudo-random source. */
export class Hand {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    if (this.seed) {
      return ((2 ** 31 - 1) & (this.seed = Math.imul(48271, this.seed))) / 2 ** 31;
    }
    return Math.random();
  }
}

/** Generate a fresh random seed in the range [0, 2^31). */
export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
