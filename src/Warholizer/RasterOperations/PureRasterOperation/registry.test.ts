import { describe, expect, it } from 'vitest';
import { OperationKind, OperationType, defaultOperations, defaultOperationsByKind, operationKinds, operationRegistry } from './registry';
import { createRoutingEngine } from './engine';
import { RasterEngine } from './engine/RasterEngine';
import { PureRasterOperation } from './types';

// The taxonomy from ADR 0002.
const expectedKinds: Record<OperationKind, OperationType[]> = {
  tone: ['invert', 'threshold', 'grayscale', 'rotateHue', 'fill', 'noise'],
  filter: ['blur', 'halftone'],
  geometry: ['crop', 'scale', 'scaleToFit', 'rotate', 'slideWrap'],
  cardinality: ['copies', 'split', 'rgbChannels', 'void', 'noop'],
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

  it('sends only per-pixel loop operations to workers', () => {
    expect(types.filter(t => operationRegistry[t].execution === 'worker').sort())
      .toEqual(['halftone', 'noise', 'rgbChannels', 'threshold']);
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
    const engine = createRoutingEngine({ main: recording('main', log), worker: recording('worker', log) });
    await engine.apply({ type: 'invert' }, []);
    await engine.apply(operationRegistry.threshold.defaults, []);
    await engine.apply(operationRegistry.halftone.defaults, []);
    await engine.apply({ type: 'noop' }, []);
    expect(log).toEqual(['main:invert', 'worker:threshold', 'worker:halftone', 'main:noop']);
  });
});
