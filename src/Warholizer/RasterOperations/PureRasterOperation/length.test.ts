import { describe, expect, it } from 'vitest';
import { convertSize, formatSize, resolveLength, resolveLengths } from './length';
import { Halftone } from './types';
import { angle } from '../../../NumberTypes';

const full = { dpi: 300, scale: 1, shortSide: 1000 };

describe('lengths', () => {
  it('reads plain numbers as pixels of the original photo, scaled for previews', () => {
    expect(resolveLength(10, full)).toBe(10);
    expect(resolveLength(10, { ...full, scale: 0.5 })).toBe(5);
  });

  it('resolves relative and physical units', () => {
    expect(resolveLength({ value: 2, unit: '%' }, full)).toBe(20);
    expect(resolveLength({ value: 1, unit: 'in' }, full)).toBe(300);
    expect(resolveLength({ value: 25.4, unit: 'mm' }, full)).toBeCloseTo(300);
    expect(resolveLength({ value: 72, unit: 'pt' }, { ...full, scale: 0.5 })).toBe(150);
  });

  it('turns lines per inch into a cell size', () => {
    expect(resolveLength({ value: 30, unit: 'lpi' }, full)).toBe(10);
    expect(resolveLength({ value: 30, unit: 'lpi' }, { ...full, scale: 0.5 })).toBe(5);
  });

  it('converts between units through the DPI', () => {
    expect(convertSize(150, 'in')).toEqual({ value: 0.5, unit: 'in' });
    expect(convertSize(10, 'lpi')).toEqual({ value: 30, unit: 'lpi' });
    expect(convertSize({ value: 30, unit: 'lpi' }, 'px')).toBe(10);
    expect(convertSize(50, '%', 300, 1000)).toEqual({ value: 5, unit: '%' });
  });

  it('resolves only the size settings of an operation', () => {
    const op: Halftone = { type: 'halftone', angle: angle(45), dotDiameter: { value: 30, unit: 'lpi' }, blurPixels: 2 };
    expect(resolveLengths(op, { ...full, scale: 0.5 })).toMatchObject({ dotDiameter: 5, blurPixels: 1, angle: 45 });
  });

  it('writes sizes with their units', () => {
    expect(formatSize(5)).toBe('5px');
    expect(formatSize({ value: 45, unit: 'lpi' })).toBe('45 lpi');
  });
});
