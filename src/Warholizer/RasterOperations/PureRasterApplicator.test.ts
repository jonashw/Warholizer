import { describe, expect, it } from 'vitest';
import { PureRasterApplicators } from './PureRasterApplicator';
import { BLUE, RED, size, solid } from './PureRasterOperation/testUtil';

describe('inputsForOp', () => {
  const inputs = [solid(4, 2, RED), solid(6, 2, BLUE)];
  const ops = [{ type: 'scale', x: 2, y: 1 } as const, { type: 'crop', x: 0, y: 0, width: 50, height: 100, unit: '%' } as const];

  it('pipe: outputs of the preceding ops', async () => {
    const app = { type: 'pipe' as const, ops, enabled: true };
    expect(await PureRasterApplicators.inputsForOp(app, 0, inputs)).toEqual(inputs);
    expect((await PureRasterApplicators.inputsForOp(app, 1, inputs)).map(size)).toEqual([[8, 2], [12, 2]]);
  });

  it('flatMap: every op sees all inputs', async () => {
    const app = { type: 'flatMap' as const, ops, enabled: true };
    expect(await PureRasterApplicators.inputsForOp(app, 1, inputs)).toEqual(inputs);
  });

  it('zip: each op sees its matching input', async () => {
    const app = { type: 'zip' as const, ops, enabled: true };
    expect(await PureRasterApplicators.inputsForOp(app, 1, inputs)).toEqual([inputs[1]]);
  });
});
