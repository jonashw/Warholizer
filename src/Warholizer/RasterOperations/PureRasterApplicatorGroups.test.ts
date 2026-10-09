import { describe, expect, it } from 'vitest';
import { ArrangementStepTemplate, PureRasterApplicator, PureRasterApplicators, stepAsRecord } from './PureRasterApplicator';
import { BLUE, RED, size, solid } from './PureRasterOperation/testUtil';

const two = () => [solid(4, 2, RED), solid(6, 2, BLUE)];
const tile: PureRasterApplicator = { type: 'pipe', enabled: true, ops: [{ type: 'tile', primaryDimension: 'x', lineLength: 2 }] };
const copies: PureRasterApplicator = { type: 'pipe', enabled: true, ops: [{ type: 'copies', n: 2 }] };

describe('applicator groups', () => {
  it("'each' runs the group's applicators per image and concatenates in image order", async () => {
    const steps: ArrangementStepTemplate[] = [{ type: 'group', mode: 'each', enabled: true, applicators: [copies, tile] }];
    const outs = await PureRasterApplicators.applyArrangement(steps, two());
    // Each image doubled and tiled on its own: 8×2 and 12×2.
    expect(outs.map(size)).toEqual([[8, 2], [12, 2]]);
  });

  it("'all' behaves like the applicators without a group", async () => {
    const grouped = await PureRasterApplicators.applyArrangement([{ type: 'group', mode: 'all', enabled: true, applicators: [copies, tile] }], two());
    const plain = await PureRasterApplicators.applyArrangement([copies, tile], two());
    expect(grouped.map(size)).toEqual(plain.map(size));
    expect(grouped.map(size)).toEqual([[10, 4]]);
  });

  it('a disabled group passes inputs through', async () => {
    const inputs = two();
    expect(await PureRasterApplicators.applyArrangement([{ type: 'group', mode: 'each', enabled: false, applicators: [tile] }], inputs)).toEqual(inputs);
  });

  it('steps before and after a group compose', async () => {
    // Per image: two copies tiled; then all results tiled together.
    const steps: ArrangementStepTemplate[] = [{ type: 'group', mode: 'each', enabled: true, applicators: [copies, tile] }, tile];
    const outs = await PureRasterApplicators.applyArrangement(steps, two());
    expect(outs.map(size)).toEqual([[20, 2]]);
  });

  it('iterations report group children, concatenated across images', async () => {
    const steps = [stepAsRecord({ type: 'group', mode: 'each', enabled: true, applicators: [copies, tile] }), stepAsRecord(tile)];
    const its = await PureRasterApplicators.applyArrangementIteratively({ steps }, two());
    expect(its.map(it => [it.inputs.length, it.outputs.length])).toEqual([[2, 2], [2, 1]]);
    expect(its[0].children!.map(c => [c.inputs.length, c.outputs.length])).toEqual([[2, 4], [4, 2]]);
  });
});
