import { describe, expect, it } from 'vitest';
import { darknessToLevels, recipeSteps, recipes } from './recipes';
import { PureRasterApplicators, allApplicators, isGroup, stepAsRecord } from './PureRasterApplicator';
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
      for (const op of allApplicators(recipeSteps(r).map(stepAsRecord)).flatMap(a => a.ops)) {
        expect(operationRegistry[op.type], `${r.id}: ${op.type}`).toBeDefined();
      }
    }
  });

  it.each(recipes.map(r => [r.name, r] as const))('%s runs', async (_, recipe) => {
    const outputs = await PureRasterApplicators.applyArrangement(recipeSteps(recipe), [subjectOnWhite(40, 30)]);
    expect(outputs.length).toBeGreaterThan(0);
    outputs.forEach(o => expect(o.width * o.height).toBeGreaterThan(0));
  });

  it('Warhol duotone grid makes a 3 × 2 grid of duotones with flat backgrounds', async () => {
    const recipe = recipes.find(r => r.id === 'warhol-duotone-grid')!;
    const [grid, ...rest] = await PureRasterApplicators.applyArrangement(recipeSteps(recipe), [subjectOnWhite(40, 30)]);
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

  it('settings stay within range and rebuild the arrangement', () => {
    for (const r of recipes) {
      for (const setting of r.settings ?? []) {
        expect(setting.default).toBeGreaterThanOrEqual(setting.min);
        expect(setting.default).toBeLessThanOrEqual(setting.max);
      }
    }
    const grid = recipes.find(r => r.id === 'warhol-duotone-grid')!;
    const ops = allApplicators(recipeSteps(grid, { darkness: 80, columns: 2 }).map(stepAsRecord)).flatMap(a => a.ops);
    expect(ops[0]).toMatchObject({ type: 'levels', ...darknessToLevels(80) });
    expect(ops[ops.length - 1]).toMatchObject({ type: 'tile', lineLength: 2 });
  });

  it('subject darkness: 50 is neutral; higher raises the black point and darkens midtones', () => {
    expect(darknessToLevels(50)).toEqual({ black: 0, gamma: 1 });
    expect(darknessToLevels(0)).toMatchObject({ black: 0 });
    expect(darknessToLevels(0).gamma).toBeGreaterThan(1);
    const levels = [60, 70, 80, 90, 100].map(darknessToLevels);
    levels.slice(1).forEach((l, i) => {
      expect(l.black).toBeGreaterThan(levels[i].black);
      expect(l.gamma).toBeLessThan(levels[i].gamma);
    });
    expect(darknessToLevels(100).black).toBeLessThan(245); // stays below the white point
  });

  it('the grid recipe is one "for each image" group, so several photos give one grid each', async () => {
    const recipe = recipes.find(r => r.id === 'warhol-duotone-grid')!;
    const steps = recipeSteps(recipe);
    expect(steps).toHaveLength(1);
    expect(isGroup(steps[0]) && steps[0].mode).toBe('each');
    const inputs = [subjectOnWhite(40, 30), subjectOnWhite(20, 10)];
    const grids = await PureRasterApplicators.applyArrangement(steps, inputs);
    expect(grids.map(size)).toEqual([[120, 60], [60, 20]]);
  });
});
