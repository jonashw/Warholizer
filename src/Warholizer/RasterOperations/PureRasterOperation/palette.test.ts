import { describe, expect, it } from 'vitest';
import { medianCutPalette, paintColors, parseHexColor, toHexColor } from './palette';
import { BLACK, BLUE, GREEN, RED, WHITE, bands } from './testUtil';

describe('palette', () => {
  it('parses and formats hex colors', () => {
    expect(parseHexColor('#ff8000')).toEqual([255, 128, 0]);
    expect(parseHexColor('#f80')).toEqual([255, 136, 0]);
    expect(parseHexColor('red')).toBeUndefined();
    expect(parseHexColor(null)).toBeUndefined();
    expect(toHexColor([255, 128, 0])).toBe('#ff8000');
  });

  it('finds the distinct colors of a flat image, darkest first', () => {
    const palette = medianCutPalette(bands(40, 10, [WHITE, RED, BLACK, GREEN]), 4);
    expect(palette).toEqual([[0, 0, 0], [255, 0, 0], [0, 255, 0], [255, 255, 255]]);
  });

  it('stops early when there are fewer distinct colors than requested', () => {
    expect(medianCutPalette(bands(20, 10, [RED, BLUE]), 8)).toHaveLength(2);
  });

  it('ignores transparent pixels', () => {
    const c = bands(20, 10, [RED, BLUE]);
    c.getContext('2d')!.clearRect(10, 0, 10, 10);
    expect(medianCutPalette(c, 4)).toEqual([[255, 0, 0]]);
  });

  it('applies replacements by position, keeping unreplaced colors', () => {
    expect(paintColors([[0, 0, 0], [255, 255, 255]], [null, '#ff0000'])).toEqual([[0, 0, 0], [255, 0, 0]]);
    expect(paintColors([[0, 0, 0], [255, 255, 255]], ['not a color'])).toEqual([[0, 0, 0], [255, 255, 255]]);
  });
});
