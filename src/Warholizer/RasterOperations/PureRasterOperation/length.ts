import { OperationType } from "./registry";
import { Length, LengthUnit, PureRasterOperation, Resolved, Size } from "./types";

/** The DPI physical units resolve through until cells carry formats (ADR 0003, Formats). */
export const defaultDpi = 300;

/**
 * What a length is measured against for one image: `scale` is the image's pixels per original
 * photo pixel (below 1 for previews), `shortSide` the image's shorter side in its own pixels.
 */
export type LengthContext = { dpi: number, scale: number, shortSide: number };

export const isLength = (v: unknown): v is Length =>
  typeof v === 'object' && v !== null && 'value' in v && 'unit' in v;

const physical: Partial<Record<LengthUnit, number>> = { in: 1, mm: 1 / 25.4, pt: 1 / 72 };

/** A size in this image's pixels. */
export const resolveLength = (size: Size, { dpi, scale, shortSide }: LengthContext): number => {
  if (typeof size === 'number') return size * scale;
  const { value, unit } = size;
  switch (unit) {
    case 'px': return value * scale;
    case '%': return value / 100 * shortSide;
    case 'lpi': return value > 0 ? dpi * scale / value : 0;
    default: return value * physical[unit]! * dpi * scale;
  }
};

/** Settings of each operation that are sizes. */
export const lengthParams: Partial<Record<OperationType, readonly string[]>> = {
  halftone: ['dotDiameter', 'blurPixels'],
  colorHalftone: ['dotDiameter', 'blurPixels'],
  blur: ['pixels'],
  stickerBorder: ['width'],
  orderedDither: ['pixelSize'],
};

/** Sizes that must be whole pixels. */
const wholePixels = new Set(['orderedDither.pixelSize']);

export const isLengthParam = (type: OperationType, param: string) =>
  lengthParams[type]?.includes(param) ?? false;

/** Units offered for a size setting; lines per inch only for screens (halftone cells). */
export const unitsFor = (type: OperationType, param: string): LengthUnit[] =>
  (type === 'halftone' || type === 'colorHalftone') && param === 'dotDiameter'
    ? ['px', '%', 'in', 'mm', 'pt', 'lpi']
    : ['px', '%', 'in', 'mm', 'pt'];

export type ResolvedOperation = PureRasterOperation extends infer O ? (O extends unknown ? Resolved<O> : never) : never;

/** `op` with every size in this image's pixels. */
export const resolveLengths = (op: PureRasterOperation, context: LengthContext): ResolvedOperation => {
  const params = lengthParams[op.type];
  if (!params) return op as ResolvedOperation;
  const record = { ...op } as Record<string, unknown>;
  for (const param of params) {
    const size = record[param] as Size | undefined;
    if (size === undefined) continue;
    const px = resolveLength(size, context);
    record[param] = wholePixels.has(`${op.type}.${param}`) ? Math.max(1, Math.round(px)) : px;
  }
  return record as ResolvedOperation;
};

/** The size's unit (plain numbers are pixels). */
export const unitOf = (size: Size): LengthUnit => typeof size === 'number' ? 'px' : size.unit;
export const valueOf = (size: Size): number => typeof size === 'number' ? size : size.value;

/** A size as written: `5px`, `2 in`, `45 lpi`. */
export const formatSize = (size: Size): string =>
  typeof size === 'number' ? `${size}px` : size.unit === 'px' ? `${size.value}px` : `${size.value} ${size.unit}`;

/** A size with this unit; pixels are stored as plain numbers. */
export const sizeOf = (value: number, unit: LengthUnit): Size => unit === 'px' ? value : { value, unit };

/**
 * The same size in another unit, through the DPI (and, for %, a reference short side in
 * original pixels). Lines per inch invert: a 10 px cell at 300 DPI is 30 lpi.
 */
export const convertSize = (size: Size, unit: LengthUnit, dpi = defaultDpi, shortSide?: number): Size => {
  const from = unitOf(size);
  if (from === unit) return size;
  const px = from === '%'
    ? (shortSide === undefined ? undefined : valueOf(size) / 100 * shortSide)
    : resolveLength(size, { dpi, scale: 1, shortSide: shortSide ?? 0 });
  if (px === undefined) return sizeOf(valueOf(size), unit);
  const round = (v: number) => Math.round(v * 1000) / 1000;
  switch (unit) {
    case 'px': return round(px);
    case '%': return shortSide ? sizeOf(round(px / shortSide * 100), unit) : sizeOf(valueOf(size), unit);
    case 'lpi': return sizeOf(px > 0 ? round(dpi / px) : 0, unit);
    default: return sizeOf(round(px / dpi / physical[unit]!), unit);
  }
};

/** Pixels of the original photo, for editors that only edit pixels (a % size keeps its number). */
export const toPixels = (size: Size): number => valueOf(convertSize(size, 'px'));
