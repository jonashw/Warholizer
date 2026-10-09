import { describe, expect, it } from 'vitest';
import { recipes } from './recipes';
import { PureRasterApplicators, applicatorAsRecord } from './PureRasterApplicator';
import { allPixels, pixel, size, solid } from './PureRasterOperation/testUtil';
import { operationRegistry } from './PureRasterOperation';

// A dark subject on a white background, like the reference's source photo.
const subjectOnWhite = (w: number, h: number) => {
  const c = solid(w, h, [255, 255, 255, 255]);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#111';
  ctx.fillRect(w / 4, h / 4, w / 2, h / 2);
  return c;
};

describe('recipes', () => {
  it('have unique ids and only registered operations', () => {
    expect(new Set(recipes.map(r => r.id)).size).toBe(recipes.length);
    for (const r of recipes) {
      for (const op of r.applicators.flatMap(a => a.ops)) {
        expect(operationRegistry[op.type], `${r.id}: ${op.type}`).toBeDefined();
      }
    }
  });

  it.each(recipes.map(r => [r.name, r] as const))('%s runs', async (_, recipe) => {
    const outputs = await PureRasterApplicators.applyAll(recipe.applicators.map(applicatorAsRecord), [subjectOnWhite(40, 30)]);
    expect(outputs.length).toBeGreaterThan(0);
    outputs.forEach(o => expect(o.width * o.height).toBeGreaterThan(0));
  });

  it('Warhol duotone grid makes a 3 × 2 grid of duotones with flat backgrounds', async () => {
    const recipe = recipes.find(r => r.id === 'warhol-duotone-grid')!;
    const [grid, ...rest] = await PureRasterApplicators.applyAll(recipe.applicators, [subjectOnWhite(40, 30)]);
    expect(rest).toHaveLength(0);
    expect(size(grid)).toEqual([120, 60]);
    // Background corners of the six tiles are the six (distinct) light stops.
    const corners = [0, 1].flatMap(r => [0, 1, 2].map(c => pixel(grid, c * 40 + 1, r * 30 + 1).join()));
    expect(new Set(corners).size).toBe(6);
    expect(pixel(grid, 1, 1)).toEqual([0xff, 0x41, 0x37, 255]);
    // Subject of the first tile takes the first shadow color (approximately, after gradient interpolation).
    const [r, g, b] = pixel(grid, 20, 15);
    expect(Math.abs(r - 0x18) + Math.abs(g - 0x3a) + Math.abs(b - 0x65)).toBeLessThan(40);
    expect(allPixels(grid).every(p => p[3] === 255)).toBe(true);
  });
});
