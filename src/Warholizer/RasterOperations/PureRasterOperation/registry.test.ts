import { describe, expect, it } from 'vitest';
import { OperationKind, OperationType, executionOf, defaultOperations, defaultOperationsByKind, operationKinds, operationRegistry, sweepsOf, withSweepValue } from './registry';
import { apply } from './apply';
import { BLUE, RED, solid } from './testUtil';
import { createRoutingEngine } from './engine';
import { RasterEngine } from './engine/RasterEngine';
import { PureRasterOperation } from './types';

// The taxonomy from ADR 0002.
const expectedKinds: Record<OperationKind, OperationType[]> = {
  tone: ['invert', 'threshold', 'grayscale', 'rotateHue', 'fill', 'noise', 'levels', 'tone', 'quantize', 'gradientMap', 'posterize', 'colorKey'],
  filter: ['blur', 'halftone', 'orderedDither', 'errorDiffusion', 'edges', 'colorHalftone'],
  geometry: ['crop', 'scale', 'scaleToFit', 'rotate', 'slideWrap', 'stickerBorder'],
  cardinality: ['copies', 'split', 'rgbChannels', 'separateColors', 'cmykChannels', 'void', 'noop'],
  layout: ['stack', 'line', 'tile', 'grid', 'printSet'],
};

const types = Object.keys(operationRegistry) as OperationType[];

describe('operation registry', () => {
  it('classifies every operation as in ADR 0002', () => {
    for (const [kind, kindTypes] of Object.entries(expectedKinds)) {
      for (const t of kindTypes) {
        expect(operationRegistry[t].kind, t).toBe(kind);
      }
    }
    expect(types.sort()).toEqual(Object.values(expectedKinds).flat().sort());
  });

  it('defaults match their registry key', () => {
    for (const t of types) {
      expect(operationRegistry[t].defaults.type).toBe(t);
    }
  });

  it('labels are unique', () => {
    const labels = types.map(t => operationRegistry[t].label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('defaultOperations lists each operation once, grouped in kind order', () => {
    expect(defaultOperations.map(op => op.type).sort()).toEqual([...types].sort());
    const kindOrder = operationKinds.map(k => k.kind);
    const kindIndexes = defaultOperations.map(op => kindOrder.indexOf(operationRegistry[op.type].kind));
    expect(kindIndexes).toEqual([...kindIndexes].sort((a, b) => a - b));
    expect(defaultOperationsByKind.flatMap(g => g.operations)).toEqual(defaultOperations);
  });

  it('sends pixel-kernel operations to the GPU and sequential ones to workers', () => {
    expect(types.filter(t => executionOf(operationRegistry[t].defaults) === 'gpu').sort()).toEqual([
      'cmykChannels', 'colorHalftone', 'edges', 'gradientMap', 'halftone', 'levels', 'noise',
      'orderedDither', 'posterize', 'quantize', 'rgbChannels', 'separateColors', 'threshold']);
    expect(types.filter(t => executionOf(operationRegistry[t].defaults) === 'worker').sort()).toEqual(['colorKey', 'errorDiffusion', 'stickerBorder', 'tone']);
    expect(executionOf({ ...operationRegistry.colorKey.defaults, connected: false })).toBe('gpu');
  });
});

describe('gallery sweeps', () => {
  const sweepCases = types.flatMap(t =>
    sweepsOf(t).flatMap(sweep =>
      sweep.values.map(value => [`${t}.${sweep.param} = ${String(value)}`, withSweepValue(operationRegistry[t].defaults, sweep.param, value)] as const)));

  it('exist for most operations', () => {
    expect(new Set(sweepCases.map(([name]) => name.split('.')[0])).size).toBeGreaterThanOrEqual(15);
  });

  it.each(sweepCases)('%s runs', async (_, op) => {
    const outputs = await apply(op, [solid(12, 8, RED), solid(12, 8, BLUE)]);
    outputs.forEach(o => expect(o).toBeInstanceOf(OffscreenCanvas));
  });
});

describe('routing engine', () => {
  const recording = (name: string, log: string[]): RasterEngine => ({
    name,
    apply: async (op: PureRasterOperation, inputs: OffscreenCanvas[]) => {
      log.push(`${name}:${op.type}`);
      return inputs;
    },
  });

  it('routes each operation by its execution hint', async () => {
    const log: string[] = [];
    const engine = createRoutingEngine({ main: recording('main', log), worker: recording('worker', log), gpu: recording('gpu', log) });
    await engine.apply({ type: 'invert' }, []);
    await engine.apply(operationRegistry.threshold.defaults, []);
    await engine.apply(operationRegistry.halftone.defaults, []);
    await engine.apply({ type: 'noop' }, []);
    expect(log).toEqual(['main:invert', 'gpu:threshold', 'gpu:halftone', 'main:noop']);
  });
});
