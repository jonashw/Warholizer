import { describe, expect, it } from 'vitest';
import { angle } from '../NumberTypes';
import { BLUE, GREEN, RED, colorDistance, pixel, solid } from '../Warholizer/RasterOperations/PureRasterOperation/testUtil';
import { allPerImage, combine, inTurn, operationNode, sequence, shuffled, variationsList, variationsSpread, warholDuotoneGrid } from './build';
import { canvasOps, drawCrosstab } from './canvasOps';
import { dealShuffled, photoCube } from './cube';
import { evaluate } from './evaluate';
import { inferComposition } from './infer';
import { defaultSpread, numericParamsOf, spreadValues } from './spread';
import { compositionText } from './text';
import { Composition, Cube, Node, PHOTO } from './types';

const doc = (root: Node): Composition => ({ version: 1, name: 'test', root: root as Composition['root'] });
const shape = async (root: Node, photos: number) => (await inferComposition(doc(root), photos)).output;
const labels = (cube: Cube<unknown>) => cube.cells.map(c => cube.dimensions.map(d => {
  const key = c.coords[d.id];
  return key === undefined ? '–' : d.members.find(m => m.key === key)!.label;
}).join('/'));

describe('spread values', () => {
  it('count always includes both ends', () => {
    expect(spreadValues({ type: 'count', param: 'angle', from: 0, to: 90, n: 5 })).toEqual([0, 22.5, 45, 67.5, 90]);
  });
  it('skip-by steps from the low end and may stop short of the high end', () => {
    expect(spreadValues({ type: 'skip-by', param: 'angle', from: 0, to: 90, by: 20 })).toEqual([0, 20, 40, 60, 80]);
    expect(spreadValues({ type: 'skip-by', param: 'angle', from: 0, to: 45, by: 15 })).toEqual([0, 15, 30, 45]);
  });
  it('rounds whole-number parameters and drops repeats', () => {
    expect(spreadValues({ type: 'count', param: 'levels', from: 2, to: 3, n: 4 }, true)).toEqual([2, 3]);
  });
  it('defaults to the registry range in five steps', () => {
    expect(defaultSpread('halftone', 'angle')).toEqual({ type: 'count', param: 'angle', from: 0, to: 75, n: 5 });
    expect(numericParamsOf('halftone').map(p => p.param)).toContain('dotDiameter');
    expect(numericParamsOf('halftone').map(p => p.param)).not.toContain('shape');
  });
});

describe('composition shapes', () => {
  it('Warhol duotone grid: 3 photos → 18 duotones → 3 grids', async () => {
    const composition = warholDuotoneGrid();
    const { output, trace } = await inferComposition(composition, 3);
    const [levels, variations, tile] = composition.root.children;
    expect(trace.get(levels.id)!.output.cells).toHaveLength(3);
    expect(trace.get(variations.id)!.output.cells).toHaveLength(18);
    expect(trace.get(variations.id)!.output.dimensions.map(d => d.name)).toEqual(['Photo', 'Gradient map']);
    expect(trace.get(tile.id)!.output.cells).toHaveLength(3);
    expect(output.dimensions.map(d => d.id)).toEqual([PHOTO]);
  });

  it('orders cells by photo first', async () => {
    const out = await shape(variationsList(allPerImage, operationNode({ type: 'invert' }), operationNode({ type: 'grayscale', percent: 100 })), 2);
    expect(labels(out)).toEqual(['1/Invert', '1/Grayscale', '2/Invert', '2/Grayscale']);
  });

  it('labels variations of one operation by the parameter that differs', async () => {
    const out = await shape(variationsList(allPerImage,
      operationNode({ type: 'halftone', angle: angle(15), dotDiameter: 5, blurPixels: 0 }),
      operationNode({ type: 'halftone', angle: angle(75), dotDiameter: 5, blurPixels: 0 })), 1);
    expect(out.dimensions[1].name).toBe('Halftone');
    expect(labels(out)).toEqual(['1/15°', '1/75°']);
  });

  it('in turn: separated channels each get the next variation, then stack per photo', async () => {
    const angles = [15, 75, 0].map(a => operationNode({ type: 'halftone', angle: angle(a), dotDiameter: 5, blurPixels: 0 }));
    const root = sequence(
      operationNode({ type: 'rgbChannels' }),
      variationsList(inTurn, ...angles),
      combine({ type: 'stack', blendingMode: 'multiply' }, [PHOTO]));
    const { trace, output } = await inferComposition(doc(root), 2);
    expect(labels(trace.get(root.children[1].id)!.output)).toEqual(['1/R/15°', '1/G/75°', '1/B/0°', '2/R/15°', '2/G/75°', '2/B/0°']);
    expect(output.cells).toHaveLength(2);
  });

  it('shuffled deals every variation evenly and deterministically', async () => {
    const deck = dealShuffled(6, 3, 7);
    expect([0, 1, 2].map(v => deck.filter(d => d === v).length)).toEqual([2, 2, 2]);
    expect(dealShuffled(6, 3, 7)).toEqual(deck);
    const out = await shape(variationsList(shuffled(7), operationNode({ type: 'invert' }), operationNode({ type: 'noop' }), operationNode({ type: 'blur', pixels: 2 })), 6);
    expect(out.cells).toHaveLength(6);
  });

  it('a two-parameter spread is a cross product with one dimension per parameter', async () => {
    const spread = variationsSpread(allPerImage, { type: 'halftone', angle: angle(45), dotDiameter: 5, blurPixels: 0 },
      { type: 'count', param: 'dotDiameter', from: 4, to: 16, n: 4 },
      { type: 'skip-by', param: 'angle', from: 0, to: 45, by: 15 });
    const out = await shape(spread, 3);
    expect(out.cells).toHaveLength(48);
    expect(out.dimensions.map(d => d.name)).toEqual(['Photo', 'Halftone dotDiameter', 'Halftone angle']);
    expect(labels(out).slice(0, 2)).toEqual(['1/4/0°', '1/4/15°']);
  });

  it('crosstab groups by everything except rows and columns', async () => {
    const spread = variationsSpread(allPerImage, { type: 'halftone', angle: angle(45), dotDiameter: 5, blurPixels: 0 },
      { type: 'count', param: 'dotDiameter', from: 4, to: 16, n: 4 },
      { type: 'count', param: 'angle', from: 0, to: 45, n: 4 });
    const root = sequence(spread, combine({ type: 'crosstab', rows: `${spread.id}:dotDiameter`, columns: `${spread.id}:angle`, labels: true }));
    const out = await shape(root, 3);
    expect(out.cells).toHaveLength(3);
    expect(out.dimensions.map(d => d.id)).toEqual([PHOTO]);
  });

  it('combine without by keeps all but the newest dimension', async () => {
    const root = sequence(
      variationsList(allPerImage, operationNode({ type: 'invert' }), operationNode({ type: 'noop' })),
      combine({ type: 'tile', primaryDimension: 'x', lineLength: 2 }));
    const out = await shape(root, 3);
    expect(out.cells).toHaveLength(3);
  });

  it('pick of one member removes the dimension; a list keeps it, in list order', async () => {
    const variations = variationsList(allPerImage, operationNode({ type: 'invert' }), operationNode({ type: 'noop' }), operationNode({ type: 'blur', pixels: 1 }));
    const children = (variations as Node & { kind: 'variations', variants: { type: 'list' } }).variants.children;
    const slice = await shape(sequence(variations, { kind: 'pick', id: 'p', dimension: variations.id, members: children[1].id }), 2);
    expect(slice.dimensions).toHaveLength(1);
    expect(slice.cells).toHaveLength(2);
    const dice = await shape(sequence(variations, { kind: 'pick', id: 'p', dimension: variations.id, members: [children[2].id, children[0].id] }), 1);
    expect(labels(dice)).toEqual(['1/Blur', '1/Invert']);
  });

  it('pivot reorders dimensions and therefore cells', async () => {
    const variations = variationsList(allPerImage, operationNode({ type: 'invert' }), operationNode({ type: 'noop' }));
    const out = await shape(sequence(variations, { kind: 'pivot', id: 'v', order: [variations.id] }), 2);
    expect(labels(out)).toEqual(['Invert/1', 'Invert/2', 'Pass through/1', 'Pass through/2']);
  });

  it('nested variations make a ragged cube', async () => {
    const root = sequence(variationsList(allPerImage,
      sequence(operationNode({ type: 'posterize', levels: 4 }), variationsList(allPerImage,
        operationNode({ type: 'gradientMap', stops: ['#000000', '#ff0000'] }),
        operationNode({ type: 'gradientMap', stops: ['#000000', '#00ff00'] }))),
      operationNode({ type: 'halftone', angle: angle(45), dotDiameter: 5, blurPixels: 0 })));
    const out = await shape(root, 1);
    expect(out.dimensions.map(d => d.name)).toEqual(['Photo', 'Variation', 'Gradient map']);
    expect(labels(out)).toEqual(['1/Posterize + Variations/#000000 → #ff0000', '1/Posterize + Variations/#000000 → #00ff00', '1/Halftone/–']);
  });

  it('void removes images; separating operations add a named dimension', async () => {
    expect((await shape(operationNode({ type: 'void' }), 3)).cells).toHaveLength(0);
    const inks = await shape(operationNode({ type: 'cmykChannels' }), 1);
    expect(inks.dimensions[1].name).toBe('Ink');
    expect(labels(inks)).toEqual(['1/C', '1/M', '1/Y', '1/K']);
  });
});

describe('rendering', () => {
  it('applies effects to every cell through the engine', async () => {
    const out = await evaluate(operationNode({ type: 'invert' }), photoCube([solid(4, 4, RED)]), canvasOps);
    expect(colorDistance(pixel(out.cells[0].image, 1, 1), [0, 255, 255, 255])).toBeLessThan(2);
  });

  it('draws a crosstab grid in row and column order', () => {
    const c = drawCrosstab([[solid(10, 10, RED), solid(10, 10, GREEN)], [solid(10, 10, BLUE), undefined]], ['a', 'b'], ['x', 'y'], false);
    expect(colorDistance(pixel(c, 5, 5), RED)).toBe(0);
    expect(colorDistance(pixel(c, c.width - 5, 5), GREEN)).toBe(0);
    expect(colorDistance(pixel(c, 5, c.height - 5), BLUE)).toBe(0);
    expect(colorDistance(pixel(c, c.width - 5, c.height - 5), [255, 255, 255, 255])).toBe(0);
  });

  it('renders the Warhol sample: one tiled grid per photo', async () => {
    const composition = warholDuotoneGrid();
    const out = await evaluate(composition.root, photoCube([solid(8, 8, RED), solid(8, 8, BLUE)]), canvasOps);
    expect(out.cells).toHaveLength(2);
    expect([out.cells[0].image.width, out.cells[0].image.height]).toEqual([24, 16]);
  });
});

describe('text view', () => {
  it('writes one node per line, children indented', () => {
    const text = compositionText(warholDuotoneGrid());
    expect(text.split('\n')).toEqual([
      'sequence',
      '  levels black: 0 white: 245 gamma: 1',
      '  variations all-per-image',
      '    gradient-map stops: [#183a65 #ff4137]',
      '    gradient-map stops: [#850564 #f3dd6d]',
      '    gradient-map stops: [#012be5 #00fcff]',
      '    gradient-map stops: [#891c72 #00e5c8]',
      '    gradient-map stops: [#980405 #88dbdf]',
      '    gradient-map stops: [#077942 #fef08d]',
      '  tile primary-dimension: x line-length: 3 by: [photo]',
    ]);
  });

  it('writes spreads with their division', () => {
    const spread = variationsSpread(allPerImage, { type: 'halftone', angle: angle(45), dotDiameter: 5, blurPixels: 0 },
      { type: 'skip-by', param: 'angle', from: 0, to: 45, by: 15 });
    expect(compositionText(doc(sequence(spread)))).toContain('angle: 0..45 skip-by: 15');
  });
});

