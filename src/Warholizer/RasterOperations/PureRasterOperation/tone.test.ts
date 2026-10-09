import { describe, expect, it } from 'vitest';
import { byte } from '../../../NumberTypes';
import { apply } from './apply';
import { RGBA, bands, pixel } from './testUtil';
import { Tone } from './types';

const gray = (v: number): RGBA => [v, v, v, 255];
const tone = (method: Tone['method']): Tone => ({ type: 'tone', method });

describe('tone', () => {
  it('manual matches levels', async () => {
    const input = bands(4, 1, [gray(0), gray(100), gray(200), gray(255)]);
    const [toned] = await apply(tone({ type: 'manual', black: byte(50), white: byte(200), gamma: 1 }), [input]);
    const [leveled] = await apply({ type: 'levels', black: byte(50), white: byte(200), gamma: 1 }, [input]);
    for (let x = 0; x < 4; x++) {
      expect(pixel(toned, x, 0)).toEqual(pixel(leveled, x, 0));
    }
  });

  it('auto-levels stretches the darkest and lightest values to black and white', async () => {
    const [out] = await apply(tone({ type: 'auto', clip: 0 }), [bands(4, 1, [gray(64), gray(96), gray(160), gray(192)])]);
    expect(pixel(out, 0, 0)).toEqual(gray(0));
    expect(pixel(out, 3, 0)).toEqual(gray(255));
  });

  it('auto-levels is group-aware: one range for all images passed together', async () => {
    const dark = bands(2, 1, [gray(0), gray(100)]);
    const light = bands(2, 1, [gray(100), gray(200)]);
    const [d, l] = await apply(tone({ type: 'auto', clip: 0 }), [dark, light]);
    // The pooled range is 0..200, so 100 maps to the same value in both images.
    expect(pixel(d, 1, 0)).toEqual(pixel(l, 0, 0));
    expect(pixel(l, 1, 0)).toEqual(gray(255));
  });

  it('match histogram gives each image the reference\'s values at the same ranks', async () => {
    const reference = bands(2, 1, [gray(150), gray(250)]);
    const source = bands(2, 1, [gray(20), gray(90)]);
    const [ref, out] = await apply(tone({ type: 'match', reference: 'first' }), [reference, source]);
    expect(pixel(ref, 0, 0)).toEqual(gray(150));
    expect(pixel(out, 0, 0)).toEqual(gray(150));
    expect(pixel(out, 1, 0)).toEqual(gray(250));
  });

  it('match histogram to the group mean makes the images\' tones agree', async () => {
    const a = bands(2, 1, [gray(0), gray(100)]);
    const b = bands(2, 1, [gray(100), gray(200)]);
    const [outA, outB] = await apply(tone({ type: 'match', reference: 'mean' }), [a, b]);
    // The mean histogram is 0: 25%, 100: 50%, 200: 25%; each image's lower half takes 100, upper half 200.
    expect([pixel(outA, 0, 0), pixel(outA, 1, 0)]).toEqual([gray(100), gray(200)]);
    expect([pixel(outB, 0, 0), pixel(outB, 1, 0)]).toEqual([gray(100), gray(200)]);
  });
});
