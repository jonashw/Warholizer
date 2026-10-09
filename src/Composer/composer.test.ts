import { describe, expect, it } from 'vitest';
import { angle } from '../NumberTypes';
import { BLUE, GREEN, RED, bands, colorDistance, pixel, solid } from '../Warholizer/RasterOperations/PureRasterOperation/testUtil';
import { allPerImage, combine, formatNode, inTurn, layout, operationNode, sequence, shuffled, variationsList, variationsSpread, warholDuotoneGrid } from './build';
import { canvasOps, drawPlan } from './canvasOps';
import { planCrosstab, planFlow } from './layoutPlan';
import { migrateComposition } from './migrate';
import { allFormats, defaultFormat } from './formats';
import { dealShuffled, photoCube } from './cube';
import { evaluate } from './evaluate';
import { inferComposition } from './infer';
import { defaultSpread, numericParamsOf, spreadValues } from './spread';
import { compositionText } from './text';
import { Composition, Cube, Node, PHOTO } from './types';
import { PureRasterOperation } from '../Warholizer/RasterOperations/PureRasterOperation/types';

const doc = (root: Node): Composition => ({ version: 1, name: 'test', root: root as Composition['root'] });
const squares = (n: number) => Array.from({ length: n }, () => [100, 100] as [number, number]);
const shape = async (root: Node, photos: number) => (await inferComposition(doc(root), squares(photos))).output;
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
    const { output, trace } = await inferComposition(composition, squares(3));
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
    const { trace, output } = await inferComposition(doc(root), squares(2));
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
    const root = sequence(spread, combine(layout({ placement: { type: 'by-dimensions', rows: [`${spread.id}:dotDiameter`], columns: [`${spread.id}:angle`] }, labels: 'headers' })));
    const out = await shape(root, 3);
    expect(out.cells).toHaveLength(3);
    expect(out.dimensions.map(d => d.id)).toEqual([PHOTO]);
  });

  it('combine without by keeps all but the newest dimension', async () => {
    const root = sequence(
      variationsList(allPerImage, operationNode({ type: 'invert' }), operationNode({ type: 'noop' })),
      combine(layout({ size: { type: 'across', n: 2 } })));
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
    const images = [solid(10, 10, RED), solid(10, 10, GREEN), solid(10, 10, BLUE)];
    const at = [[0, 1], [2, undefined]];
    const [plan] = planCrosstab({ rows: [['a'], ['b']], columns: [['x'], ['y']], at: (r, c) => at[r][c], sizes: images.map(i => [i.width, i.height]),
      fit: 'contain', align: 'center', headers: false, gutter: 0, overflow: 'spill' });
    const c = drawPlan(plan, images);
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

describe('group-aware tone', () => {
  const gray = (v: number) => [v, v, v, 255] as [number, number, number, number];
  it('matches every photo to photo 2', async () => {
    const node: Node = { kind: 'operation', id: 't', op: { type: 'tone', method: { type: 'match', reference: { photo: 2 } } } };
    const out = await evaluate(node, photoCube([bands(2, 1, [gray(10), gray(60)]), bands(2, 1, [gray(120), gray(240)])]), canvasOps);
    expect(out.cells).toHaveLength(2);
    expect(pixel(out.cells[0].image, 0, 0)).toEqual(gray(120));
    expect(pixel(out.cells[0].image, 1, 0)).toEqual(gray(240));
  });

  it('keeps statistics within each group of `by`', async () => {
    const variations = variationsList(allPerImage, operationNode({ type: 'noop' }), operationNode({ type: 'invert' }));
    const tone: Node = { kind: 'operation', id: 't', op: { type: 'tone', method: { type: 'auto', clip: 0 } }, by: [variations.id] };
    const photos = photoCube([bands(2, 1, [gray(0), gray(100)]), bands(2, 1, [gray(100), gray(200)])]);
    const out = await evaluate(sequence(variations, tone), photos, canvasOps);
    expect(out.cells).toHaveLength(4);
    // Group "Pass through" pools both photos (0..200): photo 2's 200 becomes white.
    expect(pixel(out.cells[2].image, 1, 0)).toEqual(gray(255));
  });

  it('writes its method in the text view', () => {
    const node: Node = { kind: 'operation', id: 't', op: { type: 'tone', method: { type: 'match', reference: 'mean' } }, by: ['photo'] };
    expect(compositionText(doc(sequence(node)))).toContain('tone method: match(reference: mean) by: [photo]');
  });
});

describe('lengths in compositions', () => {
  it('the preview tells the truth: sizes shrink with the preview scale', async () => {
    const seen: PureRasterOperation[] = [];
    const recording = { ...canvasOps, apply: async (op: PureRasterOperation, inputs: OffscreenCanvas[]) => { seen.push(op); return inputs; } };
    await evaluate(operationNode({ type: 'blur', pixels: 10 }), photoCube([solid(50, 50, RED)], [0.25]), recording);
    expect(seen[0]).toMatchObject({ pixels: 2.5 });
  });

  it('spreads sizes with a unit after the range', async () => {
    const spread = variationsSpread(allPerImage, { type: 'halftone', angle: angle(45), dotDiameter: 5, blurPixels: 0 },
      { type: 'count', param: 'dotDiameter', from: 30, to: 90, n: 4, unit: 'lpi' });
    const out = await shape(spread, 1);
    expect(labels(out)).toEqual(['1/30 lpi', '1/50 lpi', '1/70 lpi', '1/90 lpi']);
    expect(compositionText(doc(sequence(spread)))).toContain('dot-diameter: 30..90 lpi count: 4');
  });

  it('writes sizes in the text view', () => {
    const node = operationNode({ type: 'halftone', angle: angle(45), dotDiameter: { value: 45, unit: 'lpi' }, blurPixels: 0 });
    expect(compositionText(doc(sequence(node)))).toContain('dot-diameter: 45 lpi');
  });
});

describe('one image per variant', () => {
  const three = () => variationsList({ type: 'one-image-per-variant', order: { type: 'in-turn' }, overflow: 'spill' },
    operationNode({ type: 'invert' }), operationNode({ type: 'noop' }), operationNode({ type: 'blur', pixels: 1 }));
  const withOverflow = (overflow: 'spill' | 'drop' | 'keep') => {
    const v = three() as Extract<Node, { kind: 'variations' }>;
    return { ...v, distribution: { type: 'one-image-per-variant' as const, order: { type: 'in-turn' as const }, overflow } };
  };

  it('uses each variant once per round, spilling into a Round dimension', async () => {
    const out = await shape(withOverflow('spill'), 8);
    expect(out.dimensions.map(d => d.name)).toEqual(['Photo', 'Variation', 'Round']);
    expect(labels(out).slice(0, 4)).toEqual(['1/Invert/1', '2/Pass through/1', '3/Blur/1', '4/Invert/2']);
    expect(out.cells).toHaveLength(8);
  });

  it('drops or keeps the images beyond one round', async () => {
    expect((await shape(withOverflow('drop'), 8)).cells).toHaveLength(3);
    const kept = await shape(withOverflow('keep'), 8);
    expect(kept.cells).toHaveLength(8);
    expect(labels(kept)[3]).toBe('4/–');
  });

  it('shuffled uses every variant exactly once in each round', async () => {
    const v = { ...withOverflow('spill'), distribution: { type: 'one-image-per-variant' as const, order: { type: 'shuffled' as const, seed: 7 }, overflow: 'spill' as const } };
    const out = await shape(v, 6);
    const variation = out.dimensions[1].id;
    const round = (r: string) => out.cells.filter(c => c.coords[out.dimensions[2].id] === r).map(c => c.coords[variation]);
    expect(new Set(round('1')).size).toBe(3);
    expect(new Set(round('2')).size).toBe(3);
    expect(compositionText(doc(sequence(v)))).toContain('variations one-image-per-variant(shuffled(seed: 7), spill)');
  });
});

describe('layout planning', () => {
  const page = { width: 850, height: 1100, margin: 25, background: 'white' as const };
  const rects = (plan: { images: { x: number, y: number, w: number, h: number }[] }) => plan.images.map(i => [i.x, i.y, i.w, i.h].map(Math.round));

  it('tiles a free frame: so many across, cells the size of the largest image', () => {
    const [plan] = planFlow({ sizes: squares(5), layout: layout(), gutter: 10 });
    expect([plan.width, plan.height]).toEqual([320, 210]);
    expect(rects(plan)[4]).toEqual([110, 110, 100, 100]);
  });

  it('plans Down as Across, transposed', () => {
    const [plan] = planFlow({ sizes: squares(5), layout: layout({ size: { type: 'down', n: 3 } }), gutter: 0 });
    expect([plan.width, plan.height]).toEqual([200, 300]);
    expect(rects(plan)[3]).toEqual([100, 0, 100, 100]);
  });

  it('spills onto pages, each image once', () => {
    const plans = planFlow({ sizes: squares(18), layout: layout({ frame: { type: 'page', distribution: { type: 'one-cell-per-image', overflow: 'spill' } } }), gutter: 0, page });
    // 800 px of content across 3 is 266.7 px cells; 3 rows fit in 1050 px: 9 per page.
    expect(plans.map(p => p.images.length)).toEqual([9, 9]);
    expect([plans[0].width, plans[0].height]).toEqual([850, 1100]);
  });

  it('shrinks to fit one page by adding columns', () => {
    const plans = planFlow({ sizes: squares(18), layout: layout({ frame: { type: 'page', distribution: { type: 'one-cell-per-image', overflow: 'shrink' } } }), gutter: 0, page });
    expect(plans).toHaveLength(1);
    expect(plans[0].images).toHaveLength(18);
    expect(Math.max(...plans[0].images.map(i => i.y + i.h))).toBeLessThanOrEqual(1075.5);
  });

  it('fills a page by cycling the images in turn, whole copies only', () => {
    const [plan] = planFlow({ sizes: squares(2), layout: layout({ size: { type: 'width', size: 200 }, frame: { type: 'page', distribution: { type: 'one-image-per-cell', order: { type: 'in-turn' }, edges: 'whole-copies' } } }), cellLength: 200, gutter: 0, page });
    // 4 across (800 / 200) and 5 down (1050 / 200).
    expect(plan.images).toHaveLength(20);
    expect(plan.images.slice(0, 4).map(i => i.index)).toEqual([0, 1, 0, 1]);
  });

  it('half-brick shifts every other row by half a cell; mirror flips alternate cells', () => {
    const [brick] = planFlow({ sizes: squares(4), layout: layout({ size: { type: 'across', n: 2 }, pattern: 'half-brick' }), gutter: 0 });
    expect(rects(brick)[2]).toEqual([50, 100, 100, 100]);
    const [mirror] = planFlow({ sizes: squares(4), layout: layout({ size: { type: 'across', n: 2 }, pattern: 'mirror' }), gutter: 0 });
    expect(mirror.images.map(i => [i.flipX, i.flipY])).toEqual([[false, false], [true, false], [false, true], [true, true]]);
  });

  it('justified rows share a height and fill the width; shapes are kept', () => {
    const sizes: [number, number][] = [[200, 100], [100, 100], [100, 200], [100, 100]];
    const [plan] = planFlow({ sizes, layout: layout({ size: { type: 'across', n: 3 }, fit: 'justified' }), gutter: 0 });
    const row = plan.images.slice(0, 3);
    expect(new Set(row.map(i => Math.round(i.h))).size).toBe(1);
    expect(Math.round(row.reduce((a, i) => a + i.w, 0))).toBe(600);
    expect(row[0].w / row[0].h).toBeCloseTo(2);
  });

  it('crosstab nests headers: outer labels span their inner rows', () => {
    const [plan] = planCrosstab({ rows: [['1', '0°'], ['1', '15°'], ['2', '0°'], ['2', '15°']], columns: [['A'], ['B']],
      at: (r, c) => r * 2 + c, sizes: squares(8), fit: 'contain', align: 'center', headers: true, gutter: 0, overflow: 'spill' });
    const labels = plan.texts.map(t => t.text);
    expect(labels.filter(l => l === '1' || l === '2')).toEqual(['1', '2']);
    expect(labels.filter(l => l === '0°')).toHaveLength(2);
  });
});

describe('formats and pages', () => {
  it('a Sheet that spills adds a Page dimension', async () => {
    const root = sequence(
      variationsList(allPerImage, ...Array.from({ length: 18 }, () => operationNode({ type: 'noop' }))),
      combine(layout({ frame: { type: 'page', distribution: { type: 'one-cell-per-image', overflow: 'spill' } } }), [PHOTO]));
    const out = await shape(root, 2);
    expect(out.dimensions.map(d => d.name)).toEqual(['Photo', 'Page']);
    expect(out.cells).toHaveLength(4);
    expect(out.cells[0].image).toMatchObject({ width: 2550, height: 3300 });
  });

  it('Variations of Format make Format a dimension, each laid out for its own page', async () => {
    const square = allFormats.find(f => f.name === 'Square')!;
    const root = sequence(
      variationsList(allPerImage, formatNode(defaultFormat), formatNode(square)),
      combine(layout({ size: { type: 'across', n: 1 }, frame: { type: 'page', distribution: { type: 'one-cell-per-image', overflow: 'shrink' } } })));
    const out = await shape(root, 1);
    expect(labels(out)).toEqual(['1/Letter', '1/Square']);
    expect(out.cells.map(c => [c.image.width, c.image.height])).toEqual([[2550, 3300], [1080, 1080]]);
  });

  it('migrates Tile, Line and Crosstab to Layout', () => {
    const old = { version: 1, name: 'old', root: { kind: 'sequence', id: 'r', children: [
      { kind: 'combine', id: 'c', method: { type: 'tile', primaryDimension: 'x', lineLength: 4 }, by: ['photo'] },
      { kind: 'combine', id: 'd', method: { type: 'crosstab', rows: 'a', columns: 'b', labels: true } },
    ] } } as unknown as Composition;
    const [tile, crosstab] = (migrateComposition(old).root.children) as Extract<Node, { kind: 'combine' }>[];
    expect(tile.method).toMatchObject({ type: 'layout', size: { type: 'across', n: 4 } });
    expect(crosstab.method).toMatchObject({ type: 'layout', placement: { type: 'by-dimensions', rows: ['a'], columns: ['b'] }, labels: 'headers' });
  });

  it('writes layouts and formats in the text view', () => {
    const root = sequence(formatNode(defaultFormat),
      combine(layout({ frame: { type: 'page', distribution: { type: 'one-image-per-cell', order: { type: 'shuffled', seed: 7 }, edges: 'bleed' } }, pattern: 'half-drop' })));
    const text = compositionText(doc(root));
    expect(text).toContain('format letter 8.5 × 11 in 300 dpi');
    expect(text).toContain('layout across: 3 pattern: half-drop page: one-image-per-cell(shuffled(seed: 7), bleed)');
  });
});

describe('text view', () => {
  it('writes one node per line, children indented', () => {
    const text = compositionText(warholDuotoneGrid());
    expect(text.split('\n')).toEqual([
      'sequence',
      '  levels black: 0 white: 245 gamma: 1',
      '  variations all-variants-per-image',
      '    gradient-map stops: [#183a65 #ff4137]',
      '    gradient-map stops: [#850564 #f3dd6d]',
      '    gradient-map stops: [#012be5 #00fcff]',
      '    gradient-map stops: [#891c72 #00e5c8]',
      '    gradient-map stops: [#980405 #88dbdf]',
      '    gradient-map stops: [#077942 #fef08d]',
      '  layout across: 3 by: [photo]',
    ]);
  });

  it('writes spreads with their division', () => {
    const spread = variationsSpread(allPerImage, { type: 'halftone', angle: angle(45), dotDiameter: 5, blurPixels: 0 },
      { type: 'skip-by', param: 'angle', from: 0, to: 45, by: 15 });
    expect(compositionText(doc(sequence(spread)))).toContain('angle: 0..45 skip-by: 15');
  });
});


describe('export', () => {
  it('writes a PDF with one page per result, sized from its format', async () => {
    const { buildPdf } = await import('./export/pdf');
    const jpeg = new Uint8Array(await (await solid(4, 4, RED).convertToBlob({ type: 'image/jpeg' })).arrayBuffer());
    const pdf = new TextDecoder('latin1').decode(buildPdf([
      { jpeg, pixelWidth: 4, pixelHeight: 4, widthPt: 612, heightPt: 792 },
      { jpeg, pixelWidth: 4, pixelHeight: 4, widthPt: 216, heightPt: 216 },
    ]));
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf).toContain('/Count 2');
    expect(pdf).toContain('/MediaBox [0 0 612 792]');
    expect(pdf).toContain('/MediaBox [0 0 216 216]');
    const xref = Number(pdf.match(/startxref\n(\d+)/)![1]);
    expect(pdf.slice(xref, xref + 4)).toBe('xref');
    // Every object offset in the cross-reference table points at its object.
    const offsets = [...pdf.slice(xref).matchAll(/(\d{10}) 00000 n/g)].map(m => Number(m[1]));
    offsets.forEach((offset, i) => expect(pdf.slice(offset).startsWith(`${i + 1} 0 obj`)).toBe(true));
  });

  it('names results by their coordinates and sizes pages from their format', async () => {
    const { resultAddress, fileNameOf, pointsOf } = await import('./export/exportResults');
    const root = sequence(
      variationsList(allPerImage, ...Array.from({ length: 12 }, () => operationNode({ type: 'noop' }))),
      combine(layout({ frame: { type: 'page', distribution: { type: 'one-cell-per-image', overflow: 'spill' } } }), [PHOTO]));
    const out = await evaluate(root, photoCube([solid(100, 100, RED), solid(100, 100, BLUE)]), canvasOps);
    expect(fileNameOf(resultAddress('Warhol duotone grid', out, 1), 'pdf')).toBe('warhol-duotone-grid_photo-1_page-2.pdf');
    expect(pointsOf(out.cells[0]).map(Math.round)).toEqual([612, 792, 0]);
  });
});

describe('recipes', () => {
  it('each recipe has the shape it promises', async () => {
    const { composerRecipes } = await import('./recipes');
    const byId = Object.fromEntries(composerRecipes.map(r => [r.id, r.build()]));
    const merch = (await inferComposition(byId['merch-pack'], squares(2))).output;
    expect(merch.dimensions.map(d => d.name)).toEqual(['Photo', 'Format']);
    expect(merch.cells).toHaveLength(10);
    expect(merch.cells.slice(0, 5).map(c => c.frame?.name)).toEqual(['T-shirt', 'Mug wrap', 'Mouse pad', 'Sticker 3 in', 'Poster 18 × 24']);
    const shared = (await inferComposition(byId['shared-seed'], squares(3))).output;
    expect(shared.cells).toHaveLength(1);
    expect(shared.cells[0].image).toMatchObject({ width: 2550, height: 3300 });
    const swap = (await inferComposition(byId['role-swap'], squares(3))).output;
    expect(swap.dimensions.map(d => d.name)).toEqual(['Gradient map']);
    expect(swap.cells).toHaveLength(6);
  });
});

describe('bleed, safe areas, reading direction, crosstab fits', () => {
  it('a page with bleed grows on every side; content keeps inside margin and safe area', async () => {
    const { pageBoxOf } = await import('./formats');
    const box = pageBoxOf({ ...defaultFormat, bleed: 0.125, safe: 0.5 });
    expect([box.width, box.height]).toEqual([2625, 3375]);
    expect(box.margin).toBeCloseTo(37.5 + 150);
    const plans = planFlow({ sizes: squares(3), layout: layout({ frame: { type: 'page', distribution: { type: 'one-cell-per-image', overflow: 'spill' } } }), gutter: 0, page: box });
    expect(Math.min(...plans[0].images.map(i => i.x))).toBeCloseTo(187.5);
  });

  it('bleeding fills out past the trim to the bleed edge', () => {
    const page = { width: 2625, height: 3375, margin: 112.5, bleed: 37.5, background: 'white' as const };
    const [plan] = planFlow({ sizes: squares(2), layout: layout({ size: { type: 'width', size: 300 }, frame: { type: 'page', distribution: { type: 'one-image-per-cell', order: { type: 'in-turn' }, edges: 'bleed' } } }), cellLength: 300, gutter: 0, page });
    expect(plan.clip).toEqual({ x: 0, y: 0, w: 2625, h: 3375 });
    expect(Math.min(...plan.images.map(i => i.x))).toBe(0);
  });

  it('PDF pages with bleed carry a TrimBox for cutting', async () => {
    const { buildPdf } = await import('./export/pdf');
    const jpeg = new Uint8Array(await (await solid(4, 4, RED).convertToBlob({ type: 'image/jpeg' })).arrayBuffer());
    const pdf = new TextDecoder('latin1').decode(buildPdf([{ jpeg, pixelWidth: 4, pixelHeight: 4, widthPt: 630, heightPt: 810, bleedPt: 9 }]));
    expect(pdf).toContain('/TrimBox [9 9 621 801]');
  });

  it('reading right to left and bottom to top mirrors positions', () => {
    const [rtl] = planFlow({ sizes: squares(3), layout: layout({ reading: { horizontal: 'rtl', vertical: 'ttb' } }), gutter: 0 });
    expect(rtl.images.map(i => i.x)).toEqual([200, 100, 0]);
    const [btt] = planFlow({ sizes: squares(4), layout: layout({ size: { type: 'across', n: 2 }, reading: { horizontal: 'ltr', vertical: 'btt' } }), gutter: 0 });
    expect(btt.images.map(i => i.y)).toEqual([100, 100, 0, 0]);
  });

  it('migrated Lines keep their direction', () => {
    const old = { version: 1, name: 'old', root: { kind: 'sequence', id: 'r', children: [
      { kind: 'combine', id: 'c', method: { type: 'line', direction: 'left', squish: false } },
    ] } } as unknown as Composition;
    const [line] = migrateComposition(old).root.children as Extract<Node, { kind: 'combine' }>[];
    expect(line.method).toMatchObject({ reading: { horizontal: 'rtl', vertical: 'ttb' }, fit: 'natural' });
  });

  it('crosstab Natural sizes columns and rows to their images; Justified evens each row\'s height', () => {
    const sizes: [number, number][] = [[200, 100], [100, 100], [100, 200], [50, 50]];
    const input = { rows: [['a'], ['b']], columns: [['x'], ['y']], at: (r: number, c: number) => r * 2 + c, sizes,
      align: 'start' as const, headers: false, gutter: 0, overflow: 'spill' as const };
    const [natural] = planCrosstab({ ...input, fit: 'natural' });
    expect(natural.images.map(i => [i.x, i.y, i.w, i.h])).toEqual([[0, 0, 200, 100], [200, 0, 100, 100], [0, 100, 100, 200], [200, 100, 50, 50]]);
    const [justified] = planCrosstab({ ...input, fit: 'justified' });
    expect(justified.images.map(i => i.h)).toEqual([200, 200, 200, 200]);
    expect(justified.images.map(i => Math.round(i.w))).toEqual([400, 200, 100, 200]);
  });
});

describe('print planning', () => {
  it('knows how large each photo prints, and flags soft ones', async () => {
    const { planPrint, exportScaleOf } = await import('./printPlan');
    // One photo per Letter page, one across: about 8 in wide at 300 DPI is 2400 px.
    const root = sequence(combine(layout({ size: { type: 'across', n: 1 }, frame: { type: 'page', distribution: { type: 'one-cell-per-image', overflow: 'spill' } } }), []));
    const plan = await planPrint(doc(root), [[4800, 3200], [800, 800]]);
    expect(plan.get('1')!.photoScale).toBeCloseTo(2400 / 4800, 2);
    expect(exportScaleOf(plan.get('1'))).toBeCloseTo(0.55, 2);
    // The square photo is contained in a 3:2 cell: 1600 px tall from 800 px, so 2× and 150 DPI.
    expect(plan.get('2')!.effectiveDpi).toBe(150);
  });
});

describe('suggestions', () => {
  const ids = async (root: Node & { kind: 'sequence' }) => {
    const { suggestionsFor } = await import('./suggestions');
    const { trace } = await inferComposition(doc(root), [[100, 100], [300, 100]]);
    return suggestionsFor(root, trace);
  };

  it('sees a spread written out by hand, and converts it', async () => {
    const v = variationsList(allPerImage, ...[15, 30, 45, 60].map(a => operationNode({ type: 'halftone', angle: angle(a), dotDiameter: 5, blurPixels: 0 })));
    const root = sequence(v);
    const [s] = (await ids(root)).filter(x => x.id.startsWith('spread:'));
    const applied = s.apply!(root).children[0] as Extract<Node, { kind: 'variations' }>;
    expect(applied.variants).toMatchObject({ type: 'spread', params: [{ type: 'count', param: 'angle', from: 15, to: 60, n: 4 }] });
  });

  it('sees repeated variants and keeps one of each, cycling', async () => {
    const a = () => operationNode({ type: 'invert' });
    const b = () => operationNode({ type: 'grayscale', percent: 100 });
    const root = sequence(variationsList(inTurn, a(), b(), a(), b()));
    const [s] = (await ids(root)).filter(x => x.id.startsWith('repeats:'));
    expect(s.detail).toContain('same result');
    expect((s.apply!(root).children[0] as Extract<Node, { kind: 'variations' }>).variants).toMatchObject({ type: 'list', children: [{ op: { type: 'invert' } }, { op: { type: 'grayscale' } }] });
  });

  it('warns about a geometry step after a page', async () => {
    const root = sequence(combine(layout({ frame: { type: 'page', distribution: { type: 'one-cell-per-image', overflow: 'spill' } } }), []), operationNode({ type: 'rotate', degrees: angle(90), about: 'center' }));
    expect((await ids(root)).filter(x => x.kind === 'warning').map(x => x.title)).toEqual(['Changes a Letter page']);
  });

  it('suggests moving a color effect before a free layout, and Justified for mixed shapes', async () => {
    const root = sequence(combine(layout(), []), operationNode({ type: 'invert' }));
    const found = await ids(root);
    const move = found.find(x => x.id.startsWith('move:'))!;
    expect(move.apply!(root).children.map(c => c.kind)).toEqual(['operation', 'combine']);
    expect(found.some(x => x.id.startsWith('justify:'))).toBe(true);
  });

  it('collapses a Pick of one variant into that variant', async () => {
    const v = variationsList(allPerImage, operationNode({ type: 'invert' }), operationNode({ type: 'noop' })) as Extract<Node, { kind: 'variations' }>;
    const kept = (v.variants as { children: Node[] }).children[1];
    const root = sequence(v, { kind: 'pick', id: 'p', dimension: v.id, members: kept.id });
    const [s] = (await ids(root)).filter(x => x.id.startsWith('pick:'));
    expect(s.apply!(root).children).toEqual([kept]);
  });
});

describe('v1.1: blends, animation, zines, shared palettes', () => {
  const gray = (v: number) => [v, v, v, 255] as [number, number, number, number];

  it('Mean and Median blend each pixel across a group', async () => {
    const images = [solid(4, 4, gray(0)), solid(4, 4, gray(30)), solid(4, 4, gray(240))];
    const mean = await evaluate(combine({ type: 'mean' }, []), photoCube(images), canvasOps);
    expect(pixel(mean.cells[0].image, 1, 1)[0]).toBe(90);
    const median = await evaluate(combine({ type: 'median' }, []), photoCube(images), canvasOps);
    expect(pixel(median.cells[0].image, 1, 1)[0]).toBe(30);
  });

  it('Animate makes one animated result per group, frames in cube order at one size', async () => {
    const out = await evaluate(combine({ type: 'animate', frameMs: 200, bounce: true }, []), photoCube([solid(4, 4, RED), solid(8, 4, BLUE)]), canvasOps);
    expect(out.cells).toHaveLength(1);
    const a = out.cells[0].animation!;
    expect(a.frames.map(f => [f.width, f.height])).toEqual([[8, 4], [8, 4]]);
    expect(colorDistance(pixel(a.frames[1], 4, 2), BLUE)).toBe(0);
    const { gifOf, playOrder } = await import('./export/gif');
    expect(playOrder([1, 2, 3, 4], true)).toEqual([1, 2, 3, 4, 3, 2]);
    const bytes = new Uint8Array(await gifOf(a.frames, a.frameMs, false).arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 6))).toBe('GIF89a');
  });

  it('a mini-zine puts 8 pages on one landscape sheet, top row upside down, cover bottom right', async () => {
    const { planMiniZine } = await import('./layoutPlan');
    const [sheet] = planMiniZine({ sizes: squares(8), fit: 'contain', align: 'center', gutter: 0, page: { width: 1100, height: 850, margin: 0, background: 'white' } });
    const at = (page: number) => sheet.images.find(i => i.index === page - 1)!;
    expect([at(1).x, at(1).y, at(1).flipX]).toEqual([825, 425, false]);
    expect([at(5).x, at(5).y, at(5).flipX, at(5).flipY]).toEqual([0, 0, true, true]);
    expect([at(8).x, at(8).y]).toEqual([550, 425]);
    const root = sequence(variationsList(allPerImage, ...Array.from({ length: 10 }, () => operationNode({ type: 'noop' }))), combine(layout({ placement: { type: 'imposition', scheme: 'mini-zine-8' } }), []));
    const out = await shape(root, 1);
    expect(out.cells.map(c => [c.image.width, c.image.height])).toEqual([[3300, 2550], [3300, 2550]]);
  });

  it('a shared palette gives every image in the group the same colors', async () => {
    const op: Node = { kind: 'operation', id: 'q', op: { type: 'quantize', colors: 2, replacements: [], palette: 'shared' } };
    const out = await evaluate(op, photoCube([bands(2, 1, [gray(10), gray(60)]), bands(2, 1, [gray(200), gray(250)])]), canvasOps);
    const colors = new Set(out.cells.flatMap(c => [pixel(c.image, 0, 0)[0], pixel(c.image, 1, 0)[0]]));
    expect(colors.size).toBe(2);
    const each = await evaluate({ ...op, op: { type: 'quantize', colors: 2, replacements: [], palette: 'each' } } as Node,
      photoCube([bands(2, 1, [gray(10), gray(60)]), bands(2, 1, [gray(200), gray(250)])]), canvasOps);
    expect(new Set(each.cells.flatMap(c => [pixel(c.image, 0, 0)[0], pixel(c.image, 1, 0)[0]])).size).toBe(4);
  });
});

describe('distribution rename', () => {
  it('migrates all-per-image and one-per-image to their both-noun names', () => {
    const old = { version: 1, name: 'old', root: { kind: 'sequence', id: 'r', children: [
      { kind: 'variations', id: 'v', distribution: { type: 'all-per-image' }, variants: { type: 'list', children: [] } },
      { kind: 'variations', id: 'w', distribution: { type: 'one-per-image', order: { type: 'in-turn' } }, variants: { type: 'list', children: [] } },
    ] } } as unknown as Composition;
    const [a, b] = migrateComposition(old).root.children as Extract<Node, { kind: 'variations' }>[];
    expect(a.distribution).toEqual({ type: 'all-variants-per-image' });
    expect(b.distribution).toEqual({ type: 'one-variant-per-image', order: { type: 'in-turn' } });
  });
});

describe('incremental rendering', () => {
  it('re-renders only the edited step and what follows it', async () => {
    const { createEvaluationCache, nextGeneration, pruneUnused } = await import('./evaluate');
    const applied: string[] = [];
    const counting = { ...canvasOps, apply: async (op: PureRasterOperation, inputs: OffscreenCanvas[]) => { applied.push(op.type); return canvasOps.apply(op, inputs); } };
    const cache = createEvaluationCache<OffscreenCanvas>();
    const photos = photoCube([solid(8, 8, RED), solid(8, 8, BLUE)]);
    const invert = operationNode({ type: 'invert' });
    const blur = operationNode({ type: 'blur', pixels: 1 });
    const render = async (root: Node) => {
      nextGeneration(cache);
      const trace = new Map();
      const out = await evaluate(root, photos, counting, trace, { format: defaultFormat, cache });
      pruneUnused(cache);
      return { out, trace };
    };
    const first = await render(sequence(invert, blur));
    expect(applied).toEqual(['invert', 'invert', 'blur', 'blur']);
    applied.length = 0;
    const again = await render({ ...sequence(invert, blur), id: (first as unknown as { id: string }).id });
    expect(applied).toEqual([]);
    expect(again.out.cells[0].image).toBe(first.out.cells[0].image);
    expect(again.trace.has(invert.id)).toBe(true);
    applied.length = 0;
    await render(sequence(invert, { ...blur, op: { type: 'blur', pixels: 2 } } as Node));
    expect(applied).toEqual(['blur', 'blur']);
    expect(cache.entries.size).toBeLessThanOrEqual(4);
  });
});

describe('memory-safe export', () => {
  it('renders one photo at a time only when no step looks across photos', async () => {
    const { separableByPhoto } = await import('./export/exportResults');
    const perPhoto = sequence(variationsList(allPerImage, operationNode({ type: 'invert' }), operationNode({ type: 'noop' })), combine(layout(), [PHOTO]));
    expect(separableByPhoto(perPhoto, await shape(perPhoto, 2))).toBe(true);
    const dealt = sequence(variationsList(inTurn, operationNode({ type: 'invert' }), operationNode({ type: 'noop' })));
    expect(separableByPhoto(dealt, await shape(dealt, 2))).toBe(false);
    const pooledTone = sequence({ kind: 'operation', id: 't', op: { type: 'tone', method: { type: 'auto', clip: 1 } } } as Node);
    expect(separableByPhoto(pooledTone, await shape(pooledTone, 2))).toBe(false);
    const perPhotoTone = sequence({ kind: 'operation', id: 't', op: { type: 'tone', method: { type: 'auto', clip: 1 } }, by: [PHOTO] } as Node);
    expect(separableByPhoto(perPhotoTone, await shape(perPhotoTone, 2))).toBe(true);
    const acrossPhotos = sequence(combine(layout(), []));
    expect(separableByPhoto(acrossPhotos, await shape(acrossPhotos, 2))).toBe(false);
  });

  it('a photo rendered alone keeps its number, so results match the full render', async () => {
    const root = sequence(operationNode({ type: 'invert' }));
    const alone = await evaluate(root, photoCube([solid(4, 4, BLUE)], [1], ['2']), canvasOps);
    expect(alone.cells[0].coords[PHOTO]).toBe('2');
  });
});

describe('geometric spread', () => {
  it('keeps equal ratios between values', () => {
    expect(spreadValues({ type: 'count', param: 'dotDiameter', from: 4, to: 32, n: 4, spacing: 'geometric' })).toEqual([4, 8, 16, 32]);
    expect(spreadValues({ type: 'count', param: 'dotDiameter', from: 4, to: 13, n: 4, spacing: 'geometric' }, true)).toEqual([4, 6, 9, 13]);
  });
});

describe('dither consolidation', () => {
  it('Dither gives the same pixels as the operation it replaces, and old steps migrate', async () => {
    const { apply } = await import('../Warholizer/RasterOperations/PureRasterOperation/apply');
    const input = bands(8, 2, [[40, 40, 40, 255], [120, 120, 120, 255], [200, 200, 200, 255], [250, 250, 250, 255]]);
    const [a] = await apply({ type: 'dither', method: { type: 'error-diffusion', algorithm: 'atkinson' }, levels: 2, monochrome: true }, [input]);
    const [b] = await apply({ type: 'errorDiffusion', method: 'atkinson', levels: 2, monochrome: true }, [input]);
    for (let x = 0; x < 8; x++) expect(pixel(a, x, 1)).toEqual(pixel(b, x, 1));
    const old = { version: 1, name: 'old', root: { kind: 'sequence', id: 'r', children: [
      { kind: 'operation', id: 'd', op: { type: 'orderedDither', matrixSize: 8, levels: 3, monochrome: false, pixelSize: 2 } },
    ] } } as unknown as Composition;
    expect((migrateComposition(old).root.children[0] as Extract<Node, { kind: 'operation' }>).op)
      .toEqual({ type: 'dither', method: { type: 'ordered', matrixSize: 8, pixelSize: 2 }, levels: 3, monochrome: false });
  });
});

describe('effect fusion', () => {
  it('fuses consecutive tone steps into one pass with the same result', async () => {
    const steps = [
      operationNode({ type: 'levels', black: 20 as never, white: 230 as never, gamma: 1.3 }),
      operationNode({ type: 'invert' }),
      operationNode({ type: 'posterize', levels: 5 }),
    ];
    const root = sequence(...steps);
    const input = () => photoCube([bands(8, 1, [[0, 30, 60, 255], [90, 120, 150, 255], [180, 210, 240, 255], [255, 128, 7, 255]])]);
    let curves = 0, applies = 0;
    const counting = {
      ...canvasOps,
      apply: async (op: PureRasterOperation, inputs: OffscreenCanvas[]) => { applies++; return canvasOps.apply(op, inputs); },
      curve: async (image: OffscreenCanvas, c: Uint8Array) => { curves++; return canvasOps.curve!(image, c); },
    };
    const fused = await evaluate(root, input(), counting);
    expect([curves, applies]).toEqual([1, 0]);
    const stepwise = await evaluate(root, input(), canvasOps, new Map());
    for (let x = 0; x < 8; x++) {
      expect(colorDistance(pixel(fused.cells[0].image, x, 0), pixel(stepwise.cells[0].image, x, 0))).toBeLessThanOrEqual(1);
    }
  });

  it('does not fuse grouped steps, or across other steps', async () => {
    const { fusible } = await import('./fusion');
    expect(fusible(operationNode({ type: 'invert' }))).toBe(true);
    expect(fusible({ kind: 'operation', id: 't', op: { type: 'tone', method: { type: 'auto', clip: 1 } } })).toBe(false);
    expect(fusible(operationNode({ type: 'blur', pixels: 2 }))).toBe(false);
  });
});

describe('pick pushdown', () => {
  const counting = () => {
    const ran: string[] = [];
    return { ran, ops: { ...canvasOps, apply: async (op: PureRasterOperation, inputs: OffscreenCanvas[]) => { ran.push(op.type); return canvasOps.apply(op, inputs); } } };
  };
  const pixels = (cube: Cube<OffscreenCanvas>) => cube.cells.map(c => [JSON.stringify(c.coords), pixel(c.image, 1, 1)]);

  it('computes only the picked variant, with the same result as computing all of them', async () => {
    const v = variationsList(allPerImage,
      operationNode({ type: 'invert' }), operationNode({ type: 'grayscale', percent: 100 }), operationNode({ type: 'blur', pixels: 1 })) as Extract<Node, { kind: 'variations' }>;
    const second = (v.variants as { children: Node[] }).children[1];
    const root = sequence(v, operationNode({ type: 'rotateHue', degrees: angle(90) }), { kind: 'pick', id: 'p', dimension: v.id, members: second.id });
    const input = () => photoCube([solid(4, 4, RED), solid(4, 4, BLUE)]);
    const pushed = counting();
    const fast = await evaluate(root, input(), pushed.ops);
    expect(pushed.ran).toEqual(['grayscale', 'grayscale', 'rotateHue', 'rotateHue']);
    const full = await evaluate(root, input(), canvasOps, new Map());
    expect(pixels(fast)).toEqual(pixels(full));
  });

  it('keeps only the picked photos from the start, and stays off when a step looks across the dimension', async () => {
    const pickPhoto: Node = { kind: 'pick', id: 'p', dimension: PHOTO, members: ['2'] };
    const pushed = counting();
    const out = await evaluate(sequence(operationNode({ type: 'invert' }), pickPhoto), photoCube([solid(4, 4, RED), solid(4, 4, BLUE), solid(4, 4, GREEN)]), pushed.ops);
    expect(pushed.ran).toEqual(['invert']);
    expect(out.cells.map(c => c.coords[PHOTO])).toEqual(['2']);
    const { pushdownFor } = await import('./pushdown');
    const pooled: Node = { kind: 'operation', id: 't', op: { type: 'tone', method: { type: 'auto', clip: 0 } } };
    expect(pushdownFor([pooled, pickPhoto]).photos).toBeUndefined();
    const dealt = variationsList(inTurn, operationNode({ type: 'invert' }), operationNode({ type: 'noop' }));
    expect(pushdownFor([dealt, { kind: 'pick', id: 'q', dimension: dealt.id, members: 'x' }]).variations.size).toBe(0);
  });
});
