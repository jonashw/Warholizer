import { angle, byte, positiveNumber } from "../../../NumberTypes";
import { BlendingModes, PureRasterOperation, RotationOrigins, TilingPatterns } from "./types";

/** What an operation does to its inputs (see ADR 0002). */
export type OperationKind = 'tone' | 'filter' | 'geometry' | 'cardinality' | 'layout';

/**
 * Where the operation runs best today. Operations with per-pixel kernels run on the GPU (falling
 * back to workers); operations the browser already accelerates (ctx.filter, compositing, drawImage)
 * stay on the main thread, where they are cheaper than any transfer.
 * See docs/benchmarks/2026-10-08-worker-engine.md and 2026-10-08-gpu-kernels.md.
 */
export type ExecutionHint = 'main' | 'worker' | 'gpu';

export type OperationType = PureRasterOperation['type'];
type OperationOfType<T extends OperationType> = Extract<PureRasterOperation, { type: T }>;

type Param<O> = Exclude<keyof O, 'type'>;

/** A parameter to explore in the filter gallery, and the values to try. */
export type Sweep<O> = { [K in Param<O>]-?: { param: K, values: readonly NonNullable<O[K]>[] } }[Param<O>];

export type OperationRegistration<T extends OperationType = OperationType> = {
  kind: OperationKind,
  label: string,
  description: string,
  defaults: OperationOfType<T>,
  /** Where to run; a function when it depends on parameters (e.g. a CPU-only mode). */
  execution: ExecutionHint | ((op: OperationOfType<T>) => ExecutionHint),
  /** Parameters worth exploring, first is the default. */
  sweeps?: readonly Sweep<OperationOfType<T>>[]
};

const range = (from: number, to: number, step: number) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

export const operationKinds: { kind: OperationKind, label: string, description: string }[] = [
  { kind: 'tone', label: 'Color & tone', description: 'Changes the color of each pixel independently.' },
  { kind: 'filter', label: 'Texture', description: 'Changes pixels based on their neighbors.' },
  { kind: 'geometry', label: 'Shape & size', description: 'Changes the shape or size of each image.' },
  { kind: 'cardinality', label: 'Image count', description: 'Changes how many images flow onward, without changing pixels.' },
  { kind: 'layout', label: 'Layout', description: 'Arranges images together into one.' },
];

/** Every operation type must be registered; adding a type to PureRasterOperation without an entry fails to compile. */
export const operationRegistry: { [T in OperationType]: OperationRegistration<T> } = {
  invert: {
    kind: 'tone', label: 'Invert', execution: 'main',
    description: 'Inverts every color.',
    defaults: { type: 'invert' },
  },
  threshold: {
    kind: 'tone', label: 'Threshold', execution: 'gpu',
    description: 'Turns pixels black or white by brightness.',
    defaults: { type: 'threshold', value: byte(128) },
    sweeps: [{ param: 'value', values: range(32, 224, 32).map(byte) }],
  },
  grayscale: {
    kind: 'tone', label: 'Grayscale', execution: 'main',
    description: 'Removes color.',
    defaults: { type: 'grayscale', percent: 100 },
    sweeps: [{ param: 'percent', values: [0, 25, 50, 75, 100] }],
  },
  rotateHue: {
    kind: 'tone', label: 'Rotate hue', execution: 'main',
    description: 'Shifts every hue around the color wheel.',
    defaults: { type: 'rotateHue', degrees: angle(180) },
    sweeps: [{ param: 'degrees', values: range(0, 315, 45).map(angle) }],
  },
  fill: {
    kind: 'tone', label: 'Fill', execution: 'main',
    description: 'Blends a solid color over the image.',
    defaults: { type: 'fill', color: '#3333ff', blendingMode: 'lighter' },
    sweeps: [{ param: 'blendingMode', values: BlendingModes }, { param: 'color', values: ['#ff3333', '#ffcc00', '#33cc66', '#3333ff', '#cc33ff', '#000000'] }],
  },
  noise: {
    kind: 'tone', label: 'Noise', execution: 'gpu',
    description: 'Adds random grain.',
    defaults: { type: 'noise', monochromatic: false, amount: 30 },
    sweeps: [{ param: 'amount', values: [0, 10, 20, 30, 50, 75, 100] }, { param: 'monochromatic', values: [false, true] }],
  },
  levels: {
    kind: 'tone', label: 'Levels', execution: 'gpu',
    description: 'Sets the black point, white point, and midtone brightness (gamma).',
    defaults: { type: 'levels', black: byte(0), white: byte(255), gamma: 1 },
    sweeps: [{ param: 'gamma', values: [0.5, 0.7, 1, 1.4, 2, 3] }, { param: 'black', values: range(0, 160, 32).map(byte) }, { param: 'white', values: range(95, 255, 32).map(byte) }],
  },
  quantize: {
    kind: 'tone', label: 'Quantize', execution: 'gpu',
    description: 'Reduces the image to a few flat colors, optionally replacing each one.',
    defaults: { type: 'quantize', colors: 4, replacements: [] },
    sweeps: [{ param: 'colors', values: [2, 3, 4, 6, 8, 12, 16] }, { param: 'replacements', values: [
      [], ['#000000', '#ff3399', '#ffcc00', '#ffffff'], ['#1a1a6e', '#00a0e0', '#ff6600', '#ffee88'],
      ['#222222', '#e63946', '#a8dadc', '#f1faee'], ['#2b2d42', '#8d99ae', '#ef233c', '#edf2f4'],
    ] }],
  },
  gradientMap: {
    kind: 'tone', label: 'Gradient map', execution: 'gpu',
    description: 'Maps brightness to a color ramp; two colors make a duotone.',
    defaults: { type: 'gradientMap', stops: ['#1a1a6e', '#ff6f91', '#ffe8a3'] },
    sweeps: [{ param: 'stops', values: [
      ['#000000', '#ffffff'], ['#1a1a6e', '#ffe8a3'], ['#0b3d2e', '#f2c14e'], ['#3a0ca3', '#f72585'],
      ['#1a1a6e', '#ff6f91', '#ffe8a3'], ['#000000', '#e63946', '#f1faee'], ['#03045e', '#00b4d8', '#caf0f8'],
      ['#240046', '#ff006e', '#ffbe0b', '#ffffff'],
    ] }],
  },
  posterize: {
    kind: 'tone', label: 'Posterize', execution: 'gpu',
    description: 'Reduces each color channel to a few even steps.',
    defaults: { type: 'posterize', levels: 4 },
    sweeps: [{ param: 'levels', values: [2, 3, 4, 5, 6, 8] }],
  },
  colorKey: {
    kind: 'tone', label: 'Color key',
    description: 'Makes a color (by default, the edge color) transparent, e.g. to cut out a background.',
    // The connected mode is a sequential flood fill on the CPU; keep it off the main thread.
    execution: op => op.connected ? 'worker' : 'gpu',
    defaults: { type: 'colorKey', color: null, tolerance: 40, softness: 20, connected: true },
    sweeps: [{ param: 'tolerance', values: [10, 25, 40, 60, 90, 130] }, { param: 'softness', values: [0, 10, 20, 40, 80] }, { param: 'connected', values: [true, false] }],
  },
  blur: {
    kind: 'filter', label: 'Blur', execution: 'main',
    description: 'Softens the image.',
    defaults: { type: 'blur', pixels: 5 },
    sweeps: [{ param: 'pixels', values: [0, 1, 2, 4, 8, 16] }],
  },
  halftone: {
    kind: 'filter', label: 'Halftone', execution: 'gpu',
    description: 'Renders tones as a screen of dots sized by darkness (smooth), or the original thresholded look (classic).',
    defaults: { type: 'halftone', style: 'smooth', shape: 'round', dotDiameter: 5, blurPixels: 0, angle: angle(45), invert: false, scale: 1 },
    sweeps: [
      { param: 'dotDiameter', values: [3, 4, 6, 8, 12, 16] },
      { param: 'shape', values: ['round', 'ellipse', 'line', 'diamond'] },
      { param: 'angle', values: range(0, 75, 15).map(angle) },
      { param: 'scale', values: [1, 2, 3, 4] },
      { param: 'style', values: ['smooth', 'classic'] },
      { param: 'invert', values: [false, true] },
    ],
  },
  orderedDither: {
    kind: 'filter', label: 'Ordered dither', execution: 'gpu',
    description: 'Renders tones as a regular Bayer dot pattern, like early printers and screens.',
    defaults: { type: 'orderedDither', matrixSize: 4, levels: 2, monochrome: true, pixelSize: 1 },
    sweeps: [{ param: 'pixelSize', values: [1, 2, 3, 4, 6] }, { param: 'matrixSize', values: [2, 4, 8] }, { param: 'levels', values: [2, 3, 4] }, { param: 'monochrome', values: [true, false] }],
  },
  errorDiffusion: {
    kind: 'filter', label: 'Error-diffusion dither', execution: 'worker',
    description: 'Renders tones with few colors by spreading rounding error to neighbors (Floyd-Steinberg, Atkinson).',
    defaults: { type: 'errorDiffusion', method: 'floyd-steinberg', levels: 2, monochrome: true },
    sweeps: [{ param: 'method', values: ['floyd-steinberg', 'atkinson'] }, { param: 'levels', values: [2, 3, 4, 6] }, { param: 'monochrome', values: [true, false] }],
  },
  edges: {
    kind: 'filter', label: 'Edges', execution: 'gpu',
    description: 'Line art from the edges in the image.',
    defaults: { type: 'edges', strength: 3, threshold: byte(0), invert: false },
    sweeps: [{ param: 'strength', values: [1, 2, 3, 5, 8, 12] }, { param: 'threshold', values: [0, 40, 80, 120, 160].map(byte) }, { param: 'invert', values: [false, true] }],
  },
  colorHalftone: {
    kind: 'filter', label: 'Color halftone', execution: 'gpu',
    description: 'Comic-book CMYK dots: each ink halftoned at its own screen angle.',
    defaults: { type: 'colorHalftone', dotDiameter: 6, blurPixels: 0, shape: 'round', scale: 1 },
    sweeps: [{ param: 'dotDiameter', values: [3, 4, 6, 8, 12, 16] }, { param: 'shape', values: ['round', 'ellipse', 'line', 'diamond'] }, { param: 'scale', values: [1, 2, 3, 4] }, { param: 'blurPixels', values: [0, 1, 2, 4] }],
  },
  stickerBorder: {
    kind: 'geometry', label: 'Sticker border', execution: 'worker',
    description: 'Adds a die-cut style border around the opaque shape, optionally with a cut line.',
    defaults: { type: 'stickerBorder', width: 12, color: '#ffffff', cutLine: true },
    sweeps: [{ param: 'width', values: [4, 8, 12, 20, 32] }, { param: 'color', values: ['#ffffff', '#000000', '#ffcc00', '#ff3399'] }, { param: 'cutLine', values: [true, false] }],
  },
  crop: {
    kind: 'geometry', label: 'Crop', execution: 'main',
    description: 'Keeps a rectangular region.',
    defaults: { type: 'crop', width: 50, height: 50, x: 0, y: 0, unit: '%' },
  },
  scale: {
    kind: 'geometry', label: 'Scale', execution: 'main',
    description: 'Resizes by a factor; negative factors flip.',
    defaults: { type: 'scale', x: 0.5, y: 0.5 },
    sweeps: [{ param: 'x', values: [-1, 0.25, 0.5, 1, 1.5] }],
  },
  scaleToFit: {
    kind: 'geometry', label: 'Scale to fit', execution: 'main',
    description: 'Shrinks to fit within a size, keeping proportions.',
    defaults: { type: 'scaleToFit', w: positiveNumber(500), h: positiveNumber(500) },
  },
  rotate: {
    kind: 'geometry', label: 'Rotate', execution: 'main',
    description: 'Rotates the image.',
    defaults: { type: 'rotate', degrees: angle(90), about: 'center' },
    sweeps: [{ param: 'degrees', values: range(0, 90, 15).map(angle) }, { param: 'about', values: RotationOrigins }],
  },
  slideWrap: {
    kind: 'geometry', label: 'Slide & wrap', execution: 'main',
    description: 'Shifts the image, wrapping what falls off one edge onto the other.',
    defaults: { type: 'slideWrap', amount: 50, dimension: 'x' },
    sweeps: [{ param: 'amount', values: [0, 25, 50, 75] }, { param: 'dimension', values: ['x', 'y'] }],
  },
  copies: {
    kind: 'cardinality', label: 'Copies', execution: 'main',
    description: 'Emits n copies of the inputs.',
    defaults: { type: 'copies', n: 2 },
    sweeps: [{ param: 'n', values: [1, 2, 3, 4] }],
  },
  split: {
    kind: 'cardinality', label: 'Split', execution: 'main',
    description: 'Cuts each image into two pieces.',
    defaults: { type: 'split', dimension: 'x', amount: 50 },
    sweeps: [{ param: 'amount', values: [10, 25, 50, 75, 90] }, { param: 'dimension', values: ['x', 'y'] }],
  },
  separateColors: {
    kind: 'cardinality', label: 'Separate colors', execution: 'gpu',
    description: 'Splits the image into one layer per quantized color, like screenprint separations.',
    defaults: { type: 'separateColors', colors: 4, replacements: [] },
    sweeps: [{ param: 'colors', values: [2, 3, 4, 6] }],
  },
  cmykChannels: {
    kind: 'cardinality', label: 'CMYK channels', execution: 'gpu',
    description: 'Separates each image into cyan, magenta, yellow, and black ink layers.',
    defaults: { type: 'cmykChannels' },
  },
  rgbChannels: {
    kind: 'cardinality', label: 'RGB channels', execution: 'gpu',
    description: 'Separates each image into red, green, and blue images.',
    defaults: { type: 'rgbChannels' },
  },
  void: {
    kind: 'cardinality', label: 'Discard', execution: 'main',
    description: 'Drops all images.',
    defaults: { type: 'void' },
  },
  noop: {
    kind: 'cardinality', label: 'Pass through', execution: 'main',
    description: 'Passes images through unchanged.',
    defaults: { type: 'noop' },
  },
  stack: {
    kind: 'layout', label: 'Stack', execution: 'main',
    description: 'Layers images on top of each other with a blend mode.',
    defaults: { type: 'stack', blendingMode: 'multiply' },
    sweeps: [{ param: 'blendingMode', values: BlendingModes }],
  },
  line: {
    kind: 'layout', label: 'Line up', execution: 'main',
    description: 'Places images side by side in one direction.',
    defaults: { type: 'line', direction: 'right', squish: false },
    sweeps: [{ param: 'direction', values: ['right', 'left', 'down', 'up'] }, { param: 'squish', values: [false, true] }],
  },
  tile: {
    kind: 'layout', label: 'Tile', execution: 'main',
    description: 'Arranges images in rows of a given length.',
    defaults: { type: 'tile', primaryDimension: 'x', lineLength: 2 },
    sweeps: [{ param: 'lineLength', values: [1, 2, 3, 4] }, { param: 'primaryDimension', values: ['x', 'y'] }],
  },
  grid: {
    kind: 'layout', label: 'Grid', execution: 'main',
    description: 'Repeats each image in rows and columns.',
    defaults: { type: 'grid', rows: 2, cols: 2 },
    sweeps: [{ param: 'cols', values: [1, 2, 3, 4, 5] }, { param: 'rows', values: [1, 2, 3, 4, 5] }],
  },
  printSet: {
    kind: 'layout', label: 'Print sheet', execution: 'main',
    description: 'Fills a sheet of paper with a tiling pattern of the image.',
    defaults: { type: 'printSet', paperSize: 'letter', orientation: 'portrait', tilingPattern: 'half-drop', rowLength: positiveNumber(3) },
    sweeps: [{ param: 'tilingPattern', values: TilingPatterns }, { param: 'orientation', values: ['portrait', 'landscape'] }],
  },
};

/** A sweep with its parameter type erased, for generic UI (the per-operation types are checked above). */
export type AnySweep = { param: string, values: readonly unknown[] };

export const sweepsOf = (type: OperationType): readonly AnySweep[] =>
  (operationRegistry[type].sweeps ?? []) as readonly AnySweep[];

/** `op` with `param` set to a value taken from one of its sweeps. */
export const withSweepValue = (op: PureRasterOperation, param: string, value: unknown): PureRasterOperation =>
  ({ ...op, [param]: value }) as PureRasterOperation;

/** Where `op` should run, resolving parameter-dependent hints. */
export const executionOf = (op: PureRasterOperation): ExecutionHint => {
  const execution = operationRegistry[op.type].execution as ExecutionHint | ((op: PureRasterOperation) => ExecutionHint);
  return typeof execution === 'function' ? execution(op) : execution;
};

export const registrationOf = <T extends OperationType>(op: { type: T }): OperationRegistration<T> =>
  operationRegistry[op.type];

const registrations = Object.values(operationRegistry) as OperationRegistration[];

/** Default instance of every operation, ordered by kind (as in operationKinds) and then label. */
export const defaultOperations: PureRasterOperation[] =
  operationKinds.flatMap(({ kind }) =>
    registrations
      .filter(r => r.kind === kind)
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(r => r.defaults));

/** Default operations grouped by kind, for menus. */
export const defaultOperationsByKind = operationKinds.map(k => ({
  ...k,
  operations: defaultOperations.filter(op => operationRegistry[op.type].kind === k.kind),
}));
