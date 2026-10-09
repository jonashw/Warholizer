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

describe('quantize, separate colors, levels', () => {
  const four = () => bands(40, 4, [WHITE, RED, BLACK, GREEN]);

  it('quantize keeps an image that already has few colors', async () => {
    const out = await one({ type: 'quantize', colors: 4, replacements: [] }, four());
    expect([0, 10, 20, 30].map(x => pixel(out, x, 0))).toEqual([WHITE, RED, BLACK, GREEN]);
  });

  it('quantize replaces colors darkest first', async () => {
    const out = await one({ type: 'quantize', colors: 4, replacements: ['#0000ff', null, null, '#000000'] }, four());
    expect([0, 10, 20, 30].map(x => pixel(out, x, 0))).toEqual([BLACK, RED, BLUE, GREEN]);
  });

  it('quantize to two colors merges similar ones', async () => {
    const out = await one({ type: 'quantize', colors: 2, replacements: [] }, bands(40, 4, [BLACK, [20, 20, 20, 255], WHITE, [235, 235, 235, 255]]));
    const colors = new Set(allPixels(out).map(p => p.join()));
    expect(colors.size).toBe(2);
  });

  it('separateColors emits one layer per color, darkest first', async () => {
    const outs = await apply({ type: 'separateColors', colors: 4, replacements: [] }, [four()]);
    expect(outs).toHaveLength(4);
    // Layer 0 is the black band (x 20..29) only.
    expect(pixel(outs[0], 25, 0)).toEqual(BLACK);
    expect(pixel(outs[0], 5, 0)[3]).toBe(0);
    expect(pixel(outs[3], 5, 0)).toEqual(WHITE);
    expect(pixel(outs[3], 25, 0)[3]).toBe(0);
  });

  it('levels with defaults is identity', async () => {
    const input = bands(8, 2, [[10, 128, 250, 255], [64, 192, 0, 255]]);
    const out = await one({ type: 'levels', black: byte(0), white: byte(255), gamma: 1 }, input);
    expect(allPixels(out)).toEqual(allPixels(input));
  });

  it('levels stretches between black and white points', async () => {
    const out = await one({ type: 'levels', black: byte(64), white: byte(192), gamma: 1 }, solid(2, 2, [64, 128, 192, 255]));
    expect(pixel(out, 0, 0)).toEqual([0, 128, 255, 255]);
  });

  it('levels gamma > 1 brightens midtones', async () => {
    const out = await one({ type: 'levels', black: byte(0), white: byte(255), gamma: 2 }, solid(2, 2, [64, 64, 64, 255]));
    expect(pixel(out, 0, 0)).toEqual([128, 128, 128, 255]);
  });
});

describe('gradient map, posterize, dithering, edges, color key, sticker, CMYK', () => {
  const gray = (v: number): RGBA => [v, v, v, 255];
  const values = (c: OffscreenCanvas) => new Set(allPixels(c).map(p => p[0]));
  const whiteFraction = (c: OffscreenCanvas) => allPixels(c).filter(p => p[0] === 255).length / (c.width * c.height);

  it('gradientMap maps dark to the first stop and light to the last', async () => {
    const out = await one({ type: 'gradientMap', stops: ['#ff0000', '#0000ff'] }, bands(4, 1, [BLACK, WHITE]));
    expect(pixel(out, 0, 0)).toEqual(RED);
    expect(pixel(out, 3, 0)).toEqual(BLUE);
  });

  it('posterize to 2 levels', async () => {
    const out = await one({ type: 'posterize', levels: 2 }, bands(4, 1, [gray(100), gray(200)]));
    expect(allPixels(out)).toEqual([BLACK, BLACK, WHITE, WHITE]);
  });

  it('ordered dither renders mid gray as half white, half black', async () => {
    const out = await one({ type: 'orderedDither', matrixSize: 4, levels: 2, monochrome: true, pixelSize: 1 }, solid(16, 16, gray(128)));
    expect(values(out)).toEqual(new Set([0, 255]));
    expect(whiteFraction(out)).toBe(0.5);
  });

  it('ordered dither pixelSize makes cells', async () => {
    const out = await one({ type: 'orderedDither', matrixSize: 2, levels: 2, monochrome: true, pixelSize: 2 }, solid(8, 8, gray(128)));
    expect(pixel(out, 0, 0)).toEqual(pixel(out, 1, 1));
  });

  it.each(['floyd-steinberg', 'atkinson'] as const)('%s error diffusion keeps average tone with two levels', async (method) => {
    const out = await one({ type: 'errorDiffusion', method, levels: 2, monochrome: true }, solid(32, 32, gray(128)));
    expect(values(out)).toEqual(new Set([0, 255]));
    expect(Math.abs(whiteFraction(out) - 0.5)).toBeLessThan(0.08);
  });

  it('edges: flat image has no lines; a boundary does', async () => {
    const flat = await one({ type: 'edges', strength: 3, threshold: byte(0), invert: false }, solid(8, 8, RED));
    expect(values(flat)).toEqual(new Set([255]));
    const edge = await one({ type: 'edges', strength: 3, threshold: byte(0), invert: false }, bands(8, 4, [BLACK, WHITE]));
    expect(pixel(edge, 4, 2)[0]).toBeLessThan(128);
    expect(pixel(edge, 0, 2)[0]).toBe(255);
  });

  it('colorKey removes the key color', async () => {
    const out = await one({ type: 'colorKey', color: '#ffffff', tolerance: 10, softness: 0, connected: false }, bands(4, 1, [WHITE, RED]));
    expect(pixel(out, 0, 0)[3]).toBe(0);
    expect(pixel(out, 3, 0)).toEqual(RED);
  });

  it('colorKey connected keeps matching colors enclosed by the subject; global removes them', async () => {
    // White background, red square, white hole in the middle.
    const c = solid(12, 12, WHITE);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = 'red'; ctx.fillRect(2, 2, 8, 8);
    ctx.fillStyle = 'white'; ctx.fillRect(5, 5, 2, 2);
    const connected = await one({ type: 'colorKey', color: null, tolerance: 10, softness: 0, connected: true }, c);
    expect(pixel(connected, 0, 0)[3]).toBe(0);
    expect(pixel(connected, 5, 5)).toEqual(WHITE);
    const global = await one({ type: 'colorKey', color: null, tolerance: 10, softness: 0, connected: false }, c);
    expect(pixel(global, 5, 5)[3]).toBe(0);
  });

  it('stickerBorder grows the canvas and surrounds the shape', async () => {
    const out = await one({ type: 'stickerBorder', width: 4, color: '#ffffff', cutLine: false }, solid(10, 10, RED));
    const pad = 4 + 1;
    expect(size(out)).toEqual([10 + 2 * pad, 10 + 2 * pad]);
    expect(pixel(out, pad + 5, pad + 5)).toEqual(RED);
    expect(pixel(out, pad - 2, pad + 5)).toEqual(WHITE);
    expect(pixel(out, 0, 0)[3]).toBe(0); // rounded corner, outside the border
  });

  it('cmykChannels separates inks', async () => {
    const [c, m, y, k] = await apply({ type: 'cmykChannels' }, [bands(4, 1, [[0, 255, 255, 255], BLACK])]);
    expect([pixel(c, 0, 0), pixel(m, 0, 0), pixel(y, 0, 0), pixel(k, 0, 0)]).toEqual([[0, 255, 255, 255], WHITE, WHITE, WHITE]);
    expect([pixel(c, 3, 0), pixel(m, 3, 0), pixel(y, 3, 0), pixel(k, 3, 0)]).toEqual([WHITE, WHITE, WHITE, BLACK]);
  });

  it('colorHalftone keeps size; white stays white, black gets dark', async () => {
    const op: PureRasterOperation = { type: 'colorHalftone', dotDiameter: 4, blurPixels: 0 };
    const white = await one(op, solid(32, 32, WHITE));
    expect(size(white)).toEqual([32, 32]);
    expect(values(white)).toEqual(new Set([255]));
    const black = await one(op, solid(32, 32, BLACK));
    const mean = allPixels(black).reduce((s, p) => s + p[0], 0) / (32 * 32);
    expect(mean).toBeLessThan(128);
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

  it('copies repeats the inputs n times', async () => {
    const a = solid(2, 2, RED), b = solid(2, 2, BLUE);
    expect(await apply({ type: 'copies', n: 3 }, [a, b])).toEqual([a, b, a, b, a, b]);
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
      [{ type: 'split', dimension: 'x', amount: 50 }, { type: 'copies', n: 2 }],
      [solid(4, 2, RED), solid(4, 2, BLUE)]);
    expect(outs).toHaveLength(8);
  });

  it('applyFlatMap applies each op to all inputs and concatenates', async () => {
    const outs = await applyFlatMap([{ type: 'invert' }, { type: 'noop' }], [solid(2, 2, RED)]);
    expect(outs.map(o => pixel(o, 0, 0))).toEqual([[0, 255, 255, 255], RED]);
  });
});
