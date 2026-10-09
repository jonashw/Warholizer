import { afterAll, describe, expect, it } from 'vitest';
import { sampleOperations } from '../../../../sampleOperations';
import { PureRasterOperation } from '../types';
import { BLUE, RED, RGBA, allPixels, bands, size, solid } from '../testUtil';
import { createWorkerEngine, mainThreadEngine } from '.';

const workers = createWorkerEngine(2);
afterAll(() => workers.terminate());

// A gradient with partial transparency, to catch premultiplied-alpha or color-space drift in transfer.
const gradient = (width: number, height: number): OffscreenCanvas => {
  const c = new OffscreenCanvas(width, height);
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, 'rgba(255,0,0,1)');
  g.addColorStop(0.5, 'rgba(0,255,0,0.5)');
  g.addColorStop(1, 'rgba(0,0,255,0.2)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  return c;
};

const maxChannelDifference = (a: RGBA[], b: RGBA[]) =>
  Math.max(0, ...a.map((p, i) => Math.max(...p.map((v, j) => Math.abs(v - b[i][j])))));

describe('worker engine matches the main-thread reference', () => {
  it.each(sampleOperations.filter(op => op.type !== 'noise').map(op => [op.type, op] as const))(
    '%s',
    async (_, op) => {
      const inputs = [gradient(24, 16), bands(24, 16, [RED, BLUE])];
      const [expected, actual] = await Promise.all([
        mainThreadEngine.apply(op, inputs),
        workers.apply(op, inputs),
      ]);
      expect(actual.map(size)).toEqual(expected.map(size));
      actual.forEach((a, i) => {
        if (a.width > 0 && a.height > 0) {
          expect(maxChannelDifference(allPixels(a), allPixels(expected[i]))).toBeLessThanOrEqual(1);
        }
      });
    });

  it('noise keeps the input size', async () => {
    const [out] = await workers.apply({ type: 'noise', monochromatic: false, amount: 30 }, [solid(8, 4, RED)]);
    expect(size(out)).toEqual([8, 4]);
  });
});

describe('worker engine protocol', () => {
  it('passes inputs through by identity', async () => {
    const inputs = [solid(2, 2, RED), solid(2, 2, BLUE)];
    expect(await workers.apply({ type: 'noop' }, inputs)).toEqual(inputs);
    const [a, b, c, d] = await workers.apply({ type: 'copies', n: 2 }, inputs);
    expect([a, b, c, d]).toEqual([inputs[0], inputs[1], inputs[0], inputs[1]]);
    expect(a).toBe(inputs[0]);
  });

  it('keeps inputs usable after sending them', async () => {
    const input = solid(2, 2, RED);
    await workers.apply({ type: 'invert' }, [input]);
    expect(allPixels(input)).toEqual([RED, RED, RED, RED]);
  });

  it('round-trips zero-area images', async () => {
    const [out] = await workers.apply({ type: 'tile', primaryDimension: 'x', lineLength: 0 }, [solid(2, 2, RED)]);
    expect(size(out)).toEqual([0, 0]);
  });

  it('rejects when an operation throws', async () => {
    await expect(workers.apply({ type: 'bogus' } as unknown as PureRasterOperation, [solid(2, 2, RED)]))
      .rejects.toThrow('Unexpected operation type: bogus');
  });

  it('handles many concurrent requests', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        workers.apply({ type: 'scale', x: 1 + i, y: 1 }, [solid(2, 2, RED)])));
    expect(results.map(([o]) => o.width)).toEqual(Array.from({ length: 20 }, (_, i) => 2 * (1 + i)));
  });
});
