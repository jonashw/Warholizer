import { describe, expect, it } from 'vitest';
import { apply, applyFlatMap, applyPipeline } from './apply';
import { PureRasterOperation } from './types';
import { sampleOperations } from '../../../sampleOperations';
import { angle, byte, positiveNumber } from '../../../NumberTypes';
import {
  BLACK, BLUE, GREEN, RED, RGBA, WHITE,
  allPixels, bands, colorDistance, pixel, rows, size, solid
} from './testUtil';

const one = async (op: PureRasterOperation, input: OffscreenCanvas) => {
  const outputs = await apply(op, [input]);
  expect(outputs).toHaveLength(1);
  return outputs[0];
};

const expectColor = (actual: RGBA, expected: RGBA, tolerance = 0) =>
  expect(colorDistance(actual, expected), `${actual} ≈ ${expected}`).toBeLessThanOrEqual(tolerance);

describe('every sample operation', () => {
  it.each(sampleOperations.map(op => [op.type, op] as const))(
    '%s runs on two inputs and returns canvases',
    async (_, op) => {
      const outputs = await apply(op, [solid(16, 16, RED), solid(16, 16, BLUE)]);
      for (const o of outputs) {
        expect(o).toBeInstanceOf(OffscreenCanvas);
      }
    });
});

describe('tone operations (1→1, same size, per pixel)', () => {
  it('invert', async () => {
    const out = await one({ type: 'invert' }, solid(2, 2, RED));
    expectColor(pixel(out, 0, 0), [0, 255, 255, 255]);
  });

  it('threshold maps dark to black and light to white', async () => {
    const op: PureRasterOperation = { type: 'threshold', value: byte(128) };
    expectColor(pixel(await one(op, solid(2, 2, [100, 100, 100, 255])), 0, 0), BLACK);
    expectColor(pixel(await one(op, solid(2, 2, [200, 200, 200, 255])), 0, 0), WHITE);
  });

  it('grayscale 100% equalizes channels', async () => {
    const [r, g, b] = pixel(await one({ type: 'grayscale', percent: 100 }, solid(2, 2, RED)), 0, 0);
    expect(Math.abs(r - g)).toBeLessThanOrEqual(1);
    expect(Math.abs(g - b)).toBeLessThanOrEqual(1);
  });

  it('rotateHue 180 moves red toward cyan', async () => {
    const [r, g, b] = pixel(await one({ type: 'rotateHue', degrees: angle(180) }, solid(2, 2, RED)), 0, 0);
    expect(g).toBeGreaterThan(r);
    expect(Math.abs(g - b)).toBeLessThanOrEqual(1);
  });

  it('fill source-over replaces color', async () => {
    const out = await one({ type: 'fill', color: '#0000ff', blendingMode: 'source-over' }, solid(2, 2, RED));
    expectColor(pixel(out, 0, 0), BLUE);
  });

  it('fill multiply blends with input', async () => {
    const out = await one({ type: 'fill', color: '#0000ff', blendingMode: 'multiply' }, solid(2, 2, RED));
    expectColor(pixel(out, 0, 0), BLACK);
  });

  it('noise at 0% leaves input unchanged', async () => {
    const out = await one({ type: 'noise', monochromatic: false, amount: 0 }, solid(4, 4, RED));
    allPixels(out).forEach(p => expectColor(p, RED));
  });

  it('monochromatic noise at 100% is gray', async () => {
    const out = await one({ type: 'noise', monochromatic: true, amount: 100 }, solid(4, 4, RED));
    allPixels(out).forEach(([r, g, b]) => {
      expect(r).toBe(g);
      expect(g).toBe(b);
    });
  });
});

describe('filter operations (1→1, same size, neighborhood)', () => {
  it('blur 0 is identity', async () => {
    const input = bands(4, 2, [RED, BLUE]);
    const out = await one({ type: 'blur', pixels: 0 }, input);
    expect(allPixels(out)).toEqual(allPixels(input));
  });

  it('blur softens an edge', async () => {
    const out = await one({ type: 'blur', pixels: 2 }, bands(16, 4, [BLACK, WHITE]));
    const [r] = pixel(out, 7, 2);
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(255);
  });

  it.each([false, true])('halftone (invert=%s) keeps size and is pure black/white', async (invert) => {
    const input = bands(32, 16, [RED, BLUE, WHITE]);
    const out = await one({ type: 'halftone', angle: angle(45), dotDiameter: 4, blurPixels: 1, invert }, input);
    expect(size(out)).toEqual(size(input));
    allPixels(out).forEach(p => {
      expect([0, 255]).toContain(p[0]);
      expect(p[0]).toBe(p[1]);
      expect(p[1]).toBe(p[2]);
      expect(p[3]).toBe(255);
    });
  });
});

describe('geometry operations (1→1, size changes)', () => {
  it('crop in px', async () => {
    const out = await one({ type: 'crop', x: 2, y: 0, width: 2, height: 2, unit: 'px' }, bands(4, 2, [RED, BLUE]));
    expect(size(out)).toEqual([2, 2]);
    expectColor(pixel(out, 0, 0), BLUE);
  });

  it('crop in %', async () => {
    const out = await one({ type: 'crop', x: 50, y: 0, width: 50, height: 100, unit: '%' }, bands(8, 4, [RED, BLUE]));
    expect(size(out)).toEqual([4, 4]);
    allPixels(out).forEach(p => expectColor(p, BLUE));
  });

  it('scale up', async () => {
    const out = await one({ type: 'scale', x: 2, y: 3 }, solid(4, 2, RED));
    expect(size(out)).toEqual([8, 6]);
  });

  it('negative scale flips', async () => {
    const out = await one({ type: 'scale', x: -1, y: 1 }, bands(4, 2, [RED, BLUE]));
    expect(size(out)).toEqual([4, 2]);
    expectColor(pixel(out, 0, 0), BLUE);
    expectColor(pixel(out, 3, 0), RED);
  });

  it('scaleToFit shrinks preserving aspect ratio', async () => {
    const out = await one({ type: 'scaleToFit', w: positiveNumber(4), h: positiveNumber(4) }, solid(8, 4, RED));
    expect(size(out)).toEqual([4, 2]);
  });

  it('scaleToFit never upscales', async () => {
    const out = await one({ type: 'scaleToFit', w: positiveNumber(100), h: positiveNumber(100) }, solid(8, 4, RED));
    expect(size(out)).toEqual([8, 4]);
  });

  it('rotate 90 swaps dimensions', async () => {
    const out = await one({ type: 'rotate', degrees: angle(90), about: 'center' }, solid(4, 2, RED));
    expect(size(out)).toEqual([2, 4]);
  });

  it('rotate 90 about center turns left into top (clockwise), square', async () => {
    const out = await one({ type: 'rotate', degrees: angle(90), about: 'center' }, bands(4, 4, [RED, BLUE]));
    expectColor(pixel(out, 0, 0), RED);
    expectColor(pixel(out, 3, 3), BLUE);
  });

  it('rotate 90 about center turns left into top (clockwise), non-square', async () => {
    const out = await one({ type: 'rotate', degrees: angle(90), about: 'center' }, bands(4, 2, [RED, BLUE]));
    expect(allPixels(out)).toEqual([RED, RED, RED, RED, BLUE, BLUE, BLUE, BLUE]);
  });

  it('rotate 270 about center turns left into bottom, non-square', async () => {
    const out = await one({ type: 'rotate', degrees: angle(270), about: 'center' }, bands(4, 2, [RED, BLUE]));
    expect(size(out)).toEqual([2, 4]);
    expect(allPixels(out)).toEqual([BLUE, BLUE, BLUE, BLUE, RED, RED, RED, RED]);
  });

  it('rotate 180 about center on a non-square image', async () => {
    const out = await one({ type: 'rotate', degrees: angle(180), about: 'center' }, bands(4, 2, [RED, BLUE]));
    expect(allPixels(out)).toEqual([BLUE, BLUE, RED, RED, BLUE, BLUE, RED, RED]);
  });

  it('slideWrap x shifts right and wraps', async () => {
    const out = await one({ type: 'slideWrap', dimension: 'x', amount: 25 }, bands(4, 1, [RED, GREEN, BLUE, WHITE]));
    expect(allPixels(out)).toEqual([WHITE, RED, GREEN, BLUE]);
  });

  // Note: unlike x, the y dimension shifts *up*.
  it('slideWrap y shifts up and wraps', async () => {
    const out = await one({ type: 'slideWrap', dimension: 'y', amount: 25 }, rows(1, 4, [RED, GREEN, BLUE, WHITE]));
    expect(allPixels(out)).toEqual([GREEN, BLUE, WHITE, RED]);
  });
});

describe('cardinality operations (n→m, pixels unchanged)', () => {
  it('void drops everything', async () => {
    expect(await apply({ type: 'void' }, [solid(2, 2, RED)])).toEqual([]);
  });

  it('noop passes inputs through', async () => {
    const inputs = [solid(2, 2, RED), solid(2, 2, BLUE)];
    expect(await apply({ type: 'noop' }, inputs)).toEqual(inputs);
  });

  it('multiply repeats the inputs n times', async () => {
    const a = solid(2, 2, RED), b = solid(2, 2, BLUE);
    expect(await apply({ type: 'multiply', n: 3 }, [a, b])).toEqual([a, b, a, b, a, b]);
  });

  it('split x divides by proportion', async () => {
    const [left, right] = await apply({ type: 'split', dimension: 'x', amount: 25 }, [bands(8, 2, [RED, BLUE, BLUE, BLUE])]);
    expect(size(left)).toEqual([2, 2]);
    expect(size(right)).toEqual([6, 2]);
    allPixels(left).forEach(p => expectColor(p, RED));
    allPixels(right).forEach(p => expectColor(p, BLUE));
  });

  it('split y divides by proportion', async () => {
    const [top, bottom] = await apply({ type: 'split', dimension: 'y', amount: 50 }, [rows(2, 4, [RED, BLUE])]);
    expect(size(top)).toEqual([2, 2]);
    allPixels(top).forEach(p => expectColor(p, RED));
    allPixels(bottom).forEach(p => expectColor(p, BLUE));
  });

  it('rgbChannels separates channels onto white', async () => {
    const outs = await apply({ type: 'rgbChannels' }, [solid(2, 2, [10, 20, 30, 255])]);
    expect(outs.map(o => pixel(o, 0, 0))).toEqual([
      [10, 255, 255, 255],
      [255, 20, 255, 255],
      [255, 255, 30, 255],
    ]);
  });
});

describe('layout operations (n→1 or 1→larger)', () => {
  it('stack source-over: last input on top', async () => {
    const outs = await apply({ type: 'stack', blendingMode: 'source-over' }, [solid(2, 2, RED), solid(2, 2, BLUE)]);
    expect(outs).toHaveLength(1);
    expectColor(pixel(outs[0], 0, 0), BLUE);
  });

  it('stack of nothing is nothing', async () => {
    expect(await apply({ type: 'stack', blendingMode: 'multiply' }, [])).toEqual([]);
  });

  it.each([
    { type: 'line', direction: 'right', squish: false },
    { type: 'tile', primaryDimension: 'x', lineLength: 2 },
  ] as PureRasterOperation[])('$type of nothing is nothing', async (op) => {
    expect(await apply(op, [])).toEqual([]);
  });

  it('line right concatenates in order', async () => {
    const [out] = await apply({ type: 'line', direction: 'right', squish: false }, [solid(2, 2, RED), solid(3, 1, BLUE)]);
    expect(size(out)).toEqual([5, 2]);
    expectColor(pixel(out, 0, 0), RED);
    expectColor(pixel(out, 4, 0), BLUE);
  });

  it('line left reverses order', async () => {
    const [out] = await apply({ type: 'line', direction: 'left', squish: false }, [solid(2, 2, RED), solid(2, 2, BLUE)]);
    expectColor(pixel(out, 0, 0), BLUE);
    expectColor(pixel(out, 3, 0), RED);
  });

  it('line down stacks vertically', async () => {
    const [out] = await apply({ type: 'line', direction: 'down', squish: false }, [solid(2, 2, RED), solid(2, 2, BLUE)]);
    expect(size(out)).toEqual([2, 4]);
    expectColor(pixel(out, 0, 3), BLUE);
  });

  it('line squish keeps the first input size', async () => {
    const [out] = await apply({ type: 'line', direction: 'right', squish: true }, [solid(4, 2, RED), solid(4, 2, BLUE)]);
    expect(size(out)).toEqual([4, 2]);
    expectColor(pixel(out, 0, 0), RED);
    expectColor(pixel(out, 3, 0), BLUE);
  });

  it('tile wraps lines at lineLength', async () => {
    const [out] = await apply({ type: 'tile', primaryDimension: 'x', lineLength: 2 },
      [solid(2, 2, RED), solid(2, 2, GREEN), solid(2, 2, BLUE)]);
    expect(size(out)).toEqual([4, 4]);
    expectColor(pixel(out, 0, 0), RED);
    expectColor(pixel(out, 2, 0), GREEN);
    expectColor(pixel(out, 0, 2), BLUE);
    expect(pixel(out, 2, 2)[3]).toBe(0);
  });

  it('grid repeats rows × cols', async () => {
    const out = await one({ type: 'grid', rows: 2, cols: 3 }, solid(2, 2, RED));
    expect(size(out)).toEqual([6, 4]);
    allPixels(out).forEach(p => expectColor(p, RED));
  });

  it('grid with zero rows returns the input unchanged', async () => {
    const input = solid(2, 2, RED);
    expect(await one({ type: 'grid', rows: 0, cols: 2 }, input)).toBe(input);
  });

  // Regression: printSet draws asynchronously; apply must not resolve before drawing finishes.
  it.each(['normal', 'half-drop', 'half-brick', 'mirror', 'wacky'] as const)(
    'printSet (%s) is fully drawn when apply resolves', async (tilingPattern) => {
      const out = await one({ type: 'printSet', paperSize: 'letter', orientation: 'portrait', tilingPattern, rowLength: positiveNumber(3) }, solid(10, 10, RED));
      // Read synchronously, before any other task can run.
      allPixels(out).forEach(p => expectColor(p, RED));
    });

  it('printSet matches paper aspect ratio', async () => {
    const out = await one({ type: 'printSet', paperSize: 'letter', orientation: 'portrait', tilingPattern: 'normal', rowLength: positiveNumber(3) }, solid(10, 10, RED));
    expect(out.width).toBe(30);
    expect(out.height).toBe(Math.floor(30 / (8.5 / 11)));
    expectColor(pixel(out, 0, 0), RED);
  });
});

describe('composition', () => {
  it('applyPipeline threads each input through ops in sequence', async () => {
    const outs = await applyPipeline(
      [{ type: 'split', dimension: 'x', amount: 50 }, { type: 'multiply', n: 2 }],
      [solid(4, 2, RED), solid(4, 2, BLUE)]);
    expect(outs).toHaveLength(8);
  });

  it('applyFlatMap applies each op to all inputs and concatenates', async () => {
    const outs = await applyFlatMap([{ type: 'invert' }, { type: 'noop' }], [solid(2, 2, RED)]);
    expect(outs.map(o => pixel(o, 0, 0))).toEqual([[0, 255, 255, 255], RED]);
  });
});
