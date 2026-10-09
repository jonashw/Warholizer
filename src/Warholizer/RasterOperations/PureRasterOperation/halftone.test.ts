import { describe, expect, it } from 'vitest';
import { dotShapes, spot, thresholdFor, toneTable } from './halftone';

describe('halftone screen math', () => {
  it.each(dotShapes)('%s spot values lie in [0, 1]', (shape) => {
    for (const x of [-1, -0.5, 0, 0.5, 1]) {
      for (const y of [-1, -0.5, 0, 0.5, 1]) {
        const v = spot(shape, x, y);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it.each(dotShapes)('%s tone table: no ink at 0, full ink at 1, monotonic', (shape) => {
    const table = toneTable(shape);
    expect(thresholdFor(table, 0)).toBeLessThan(0);
    expect(thresholdFor(table, 1)).toBeGreaterThan(1);
    for (let i = 1; i < table.length; i++) {
      expect(table[i]).toBeGreaterThanOrEqual(table[i - 1]);
    }
  });

  it('round dots touch at about 78.5% coverage (π/4), where the threshold reaches 0.5', () => {
    expect(thresholdFor(toneTable('round'), Math.PI / 4)).toBeCloseTo(0.5, 1);
  });
});
