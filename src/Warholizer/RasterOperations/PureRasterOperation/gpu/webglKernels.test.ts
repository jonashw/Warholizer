import { describe, expect, it } from 'vitest';
import { cpuKernels } from '../kernels';
import { createApply } from '../apply';
import { byte, angle } from '../../../../NumberTypes';
import { BLUE, RED, RGBA, allPixels, bands, size, solid } from '../testUtil';
import { PureRasterOperation } from '../types';
import { createWebglKernels } from './webglKernels';

const gpuKernels = createWebglKernels();

// A photo-like test image: smooth gradients, partial transparency, and per-pixel variation.
const testImage = (width: number, height: number): OffscreenCanvas => {
  const c = new OffscreenCanvas(width, height);
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, 'rgba(255,40,0,1)');
  g.addColorStop(0.5, 'rgba(20,200,90,0.6)');
  g.addColorStop(1, 'rgba(10,30,255,0.3)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgb(${(i * 37) % 256},${(i * 91) % 256},${(i * 53) % 256})`;
    ctx.fillRect((i * 7) % width, (i * 11) % height, 3, 2);
  }
  return c;
};

const channelDiff = (a: RGBA, b: RGBA) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));

/** Fraction of pixels differing by more than `tolerance` in any channel. */
const mismatchRate = (a: OffscreenCanvas, b: OffscreenCanvas, tolerance: number) => {
  const pa = allPixels(a), pb = allPixels(b);
  return pa.filter((p, i) => channelDiff(p, pb[i]) > tolerance).length / pa.length;
};

describe('WebGL2 kernels', () => {
  it('are available in the test browser', () => {
    expect(gpuKernels, 'WebGL2 unavailable: GPU parity tests below are skipped').toBeDefined();
  });

  describe.runIf(gpuKernels)('match the CPU reference', () => {
    const gpu = gpuKernels!;

    it.each([1, 64, 128, 200])('threshold %i', async (value) => {
      const input = testImage(64, 48);
      const [expected, actual] = await Promise.all([cpuKernels.threshold(input, byte(value)), gpu.threshold(input, byte(value))]);
      expect(size(actual)).toEqual(size(expected));
      // Pixels exactly at the threshold may round either way.
      expect(mismatchRate(actual, expected, 0)).toBeLessThan(0.005);
    });

    it('threshold keeps orientation', async () => {
      const out = await gpu.threshold(bands(4, 2, [[255, 255, 255, 255], [0, 0, 0, 255]]), byte(128));
      expect(allPixels(out)).toEqual([
        [255, 255, 255, 255], [255, 255, 255, 255], [0, 0, 0, 255], [0, 0, 0, 255],
        [255, 255, 255, 255], [255, 255, 255, 255], [0, 0, 0, 255], [0, 0, 0, 255],
      ]);
    });

    it('rgbChannels', async () => {
      const input = testImage(64, 48);
      const [expected, actual] = await Promise.all([cpuKernels.rgbChannels(input), gpu.rgbChannels(input)]);
      expect(actual.map(size)).toEqual(expected.map(size));
      // Semi-transparent pixels may round by a unit or two through premultiplied canvas storage.
      actual.forEach((a, i) => expect(mismatchRate(a, expected[i], 2)).toBe(0));
    });

    it('noise at 0% leaves the input unchanged', async () => {
      const input = bands(8, 4, [RED, BLUE]);
      const out = await gpu.noise(input, { type: 'noise', monochromatic: false, amount: 0 });
      expect(mismatchRate(out, input, 1)).toBe(0);
    });

    it('monochromatic noise at 100% is opaque gray', async () => {
      const out = await gpu.noise(solid(16, 16, RED), { type: 'noise', monochromatic: true, amount: 100 });
      allPixels(out).forEach(([r, g, b, a]) => {
        expect(r).toBe(g);
        expect(g).toBe(b);
        expect(a).toBe(255);
      });
    });

    it('noise is random: varies across pixels and across calls', async () => {
      const op = { type: 'noise', monochromatic: false, amount: 100 } as const;
      const [a, b] = await Promise.all([gpu.noise(solid(16, 16, RED), op), gpu.noise(solid(16, 16, RED), op)]);
      const values = allPixels(a).map(p => p[0]);
      expect(new Set(values).size).toBeGreaterThan(100);
      expect(mismatchRate(a, b, 0)).toBeGreaterThan(0.9);
      const mean = values.reduce((x, y) => x + y, 0) / values.length;
      expect(mean).toBeGreaterThan(100);
      expect(mean).toBeLessThan(155);
    });

    it('halftone through the shared composition code', async () => {
      const input = testImage(96, 64);
      const op: PureRasterOperation = { type: 'halftone', angle: angle(15), dotDiameter: 4, blurPixels: 1, invert: false };
      const [[expected], [actual]] = await Promise.all([createApply(cpuKernels)(op, [input]), createApply(gpu)(op, [input])]);
      expect(mismatchRate(actual, expected, 0)).toBeLessThan(0.01);
    });

    it('mapToPalette', async () => {
      const input = testImage(64, 48);
      const match: [number, number, number][] = [[0, 0, 0], [255, 40, 0], [20, 200, 90], [10, 30, 255], [255, 255, 255]];
      const paint: [number, number, number][] = [[255, 0, 255], [0, 0, 0], [255, 255, 0], [0, 255, 255], [9, 9, 9]];
      const [expected, actual] = await Promise.all([cpuKernels.mapToPalette(input, match, paint), gpu.mapToPalette(input, match, paint)]);
      // Equidistant pixels may resolve differently; alpha may round by a unit.
      expect(mismatchRate(actual, expected, 2)).toBeLessThan(0.005);
      const [e2, a2] = await Promise.all([cpuKernels.mapToPalette(input, match, paint, 2), gpu.mapToPalette(input, match, paint, 2)]);
      expect(mismatchRate(a2, e2, 2)).toBeLessThan(0.005);
    });

    it.each([[0, 255, 1], [40, 200, 1], [0, 255, 2.2], [30, 220, 0.6]])('levels %i..%i γ%f', async (black, white, gamma) => {
      const input = testImage(64, 48);
      const [expected, actual] = await Promise.all([cpuKernels.levels(input, black, white, gamma), gpu.levels(input, black, white, gamma)]);
      expect(mismatchRate(actual, expected, 2)).toBe(0);
    });

    it('falls back to the CPU for zero-area images', async () => {
      const out = await gpu.threshold(new OffscreenCanvas(0, 3), byte(128));
      expect(size(out)).toEqual([0, 3]);
    });
  });
});
