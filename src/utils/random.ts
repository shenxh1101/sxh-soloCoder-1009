export class SeededRandom {
  private seed: number;

  constructor(seed?: number) {
    this.seed = seed ?? Date.now();
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextFloat(min: number, max: number, decimals: number = 2): number {
    const value = this.next() * (max - min) + min;
    return parseFloat(value.toFixed(decimals));
  }

  pick<T>(array: T[]): T {
    const index = this.nextInt(0, array.length - 1);
    return array[index];
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

export function createSeededRandom(seed?: number): SeededRandom {
  return new SeededRandom(seed);
}
