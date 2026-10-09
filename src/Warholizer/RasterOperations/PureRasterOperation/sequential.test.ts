import { describe, expect, it } from 'vitest';
import { distanceTransform } from './sequential';
import { bayerMatrix } from './kernels';

describe('distanceTransform', () => {
  it('measures Euclidean distance to the nearest inside pixel', () => {
    const w = 7, h = 5;
    const inside = new Uint8Array(w * h);
    inside[2 * w + 3] = 1; // center
    const d = distanceTransform(inside, w, h);
    expect(d[2 * w + 3]).toBe(0);
    expect(d[2 * w + 6]).toBeCloseTo(3);
    expect(d[0]).toBeCloseTo(Math.hypot(3, 2));
  });
});

describe('bayerMatrix', () => {
  it('is a permutation of 0..n²-1 with the standard 2×2 layout', () => {
    expect(bayerMatrix(2)).toEqual([0, 2, 3, 1]);
    for (const n of [4, 8]) {
      expect([...bayerMatrix(n)].sort((a, b) => a - b)).toEqual(Array.from({ length: n * n }, (_, i) => i));
    }
  });
});
