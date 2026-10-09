import { angle, byte, positiveNumber } from "../../../NumberTypes";
import { PureRasterOperation } from "./types";

/** What an operation does to its inputs (see ADR 0002). */
export type OperationKind = 'tone' | 'filter' | 'geometry' | 'cardinality' | 'layout';

/**
 * Where the operation runs best today. Per-pixel JavaScript loops go to workers; operations the
 * browser already accelerates (ctx.filter, compositing, drawImage) are cheaper than the transfer.
 * See docs/benchmarks/2026-10-08-worker-engine.md.
 */
export type ExecutionHint = 'main' | 'worker';

export type OperationType = PureRasterOperation['type'];
type OperationOfType<T extends OperationType> = Extract<PureRasterOperation, { type: T }>;

export type OperationRegistration<T extends OperationType = OperationType> = {
  kind: OperationKind,
  label: string,
  description: string,
  defaults: OperationOfType<T>,
  execution: ExecutionHint
};

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
    kind: 'tone', label: 'Threshold', execution: 'worker',
    description: 'Turns pixels black or white by brightness.',
    defaults: { type: 'threshold', value: byte(128) },
  },
  grayscale: {
    kind: 'tone', label: 'Grayscale', execution: 'main',
    description: 'Removes color.',
    defaults: { type: 'grayscale', percent: 100 },
  },
  rotateHue: {
    kind: 'tone', label: 'Rotate hue', execution: 'main',
    description: 'Shifts every hue around the color wheel.',
    defaults: { type: 'rotateHue', degrees: angle(180) },
  },
  fill: {
    kind: 'tone', label: 'Fill', execution: 'main',
    description: 'Blends a solid color over the image.',
    defaults: { type: 'fill', color: '#3333ff', blendingMode: 'lighter' },
  },
  noise: {
    kind: 'tone', label: 'Noise', execution: 'worker',
    description: 'Adds random grain.',
    defaults: { type: 'noise', monochromatic: false, amount: 30 },
  },
  blur: {
    kind: 'filter', label: 'Blur', execution: 'main',
    description: 'Softens the image.',
    defaults: { type: 'blur', pixels: 5 },
  },
  halftone: {
    kind: 'filter', label: 'Halftone', execution: 'worker',
    description: 'Renders the image as a pattern of dots.',
    defaults: { type: 'halftone', dotDiameter: 3.5, blurPixels: 1, angle: angle(0), dotsOnly: false, invert: true },
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
  },
  slideWrap: {
    kind: 'geometry', label: 'Slide & wrap', execution: 'main',
    description: 'Shifts the image, wrapping what falls off one edge onto the other.',
    defaults: { type: 'slideWrap', amount: 50, dimension: 'x' },
  },
  copies: {
    kind: 'cardinality', label: 'Copies', execution: 'main',
    description: 'Emits n copies of the inputs.',
    defaults: { type: 'copies', n: 2 },
  },
  split: {
    kind: 'cardinality', label: 'Split', execution: 'main',
    description: 'Cuts each image into two pieces.',
    defaults: { type: 'split', dimension: 'x', amount: 50 },
  },
  rgbChannels: {
    kind: 'cardinality', label: 'RGB channels', execution: 'worker',
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
  },
  line: {
    kind: 'layout', label: 'Line up', execution: 'main',
    description: 'Places images side by side in one direction.',
    defaults: { type: 'line', direction: 'right', squish: false },
  },
  tile: {
    kind: 'layout', label: 'Tile', execution: 'main',
    description: 'Arranges images in rows of a given length.',
    defaults: { type: 'tile', primaryDimension: 'x', lineLength: 2 },
  },
  grid: {
    kind: 'layout', label: 'Grid', execution: 'main',
    description: 'Repeats each image in rows and columns.',
    defaults: { type: 'grid', rows: 2, cols: 2 },
  },
  printSet: {
    kind: 'layout', label: 'Print sheet', execution: 'main',
    description: 'Fills a sheet of paper with a tiling pattern of the image.',
    defaults: { type: 'printSet', paperSize: 'letter', orientation: 'portrait', tilingPattern: 'half-drop', rowLength: positiveNumber(3) },
  },
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
