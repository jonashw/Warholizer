import React from 'react';
import { ButtonRadiosInput } from './Warholizer/RasterOperations/ButtonRadiosInput';
import { positiveNumber } from './Warholizer/RasterOperations/NumberTypes';
import {  PureRasterApplicator, PureRasterTransformerRecord, transformerAsRecord } from './Warholizer/RasterOperations/PureRasterApplicator';
import { ImageGraphSideBySide } from './ImageGraphSideBySide';
import { ImageRecord, imageAsRecord } from './ImageRecord';
import ImageUtil from './Warholizer/ImageUtil';

export type DagMode = | 'td' | 'bu' | 'lr' | 'rl' | 'radialout' | 'radialin';
const dagModes: DagMode[] = ['td', 'bu', 'lr', 'rl', 'radialout', 'radialin'];
const transformers: PureRasterTransformerRecord[] = ([
  [
    {
      type: 'pipe',
      ops: [
        { type: 'scaleToFit', h: positiveNumber(100), w: positiveNumber(100) },
        { type: 'slideWrap', amount: 50, dimension: 'x' },
        { type: 'slideWrap', amount: 50, dimension: 'y' },
        { type: 'grid', cols: 2, rows: 2 }
      ]
    }
  ] as PureRasterApplicator[],
  [
    {
      type: 'flatMap',
      ops: [
        { type: 'scaleToFit', h: positiveNumber(100), w: positiveNumber(100) }
      ]
    },
    {
      type: 'flatMap',
      ops: [
        { type: 'slideWrap', dimension:'y',amount:50},
        { type: 'noop'},
      ]
    },
    {
      type:'pipe',
      ops: [
        { type: 'line', direction: 'right' },
        { type: 'grid', cols:2, rows:2 }
      ]
    }
  ] as PureRasterApplicator[],
  [
    {
      type: 'flatMap',
      ops: [
        { type: 'scaleToFit', h: positiveNumber(100), w: positiveNumber(100) }
      ]
    },
    {
      type: 'flatMap',
      ops: [...Array(4).keys()].map((i,_,arr) => 
        ({ type: 'slideWrap', dimension:'y',amount:i*100/arr.length}))
    },
    {
      type:'pipe',
      ops: [
        { type: 'line', direction: 'right' },
        { type: 'grid', cols:2, rows:2 }
      ]
    }
  ] as PureRasterApplicator[]
]).map(transformerAsRecord);

export function GraphViewerDemo() {
  const [dagMode,setDagMode] = React.useState<DagMode>('td');
  const [inputs,setInputs] = React.useState<ImageRecord[]>([]);

  React.useEffect(() => {
    Promise.all([
      "/warhol.jpg",
      //"banana.jpg"
    ].map(ImageUtil.loadOffscreen))
    .then(inputs => inputs.map(imageAsRecord))
    .then(setInputs);
  },[]);

  return <div className="text-white text-center">
    <div>
      <ButtonRadiosInput 
        options={dagModes.map(value => ({ value, label: value }))}
        onChange={setDagMode}
        value={dagMode}
      />
    </div>
    {transformers.map((t,i) => 
      <>
        {i>0 && <hr/>}
        <ImageGraphSideBySide 
          inputs={inputs}
          key={t.id}
          dagMode={dagMode}
          applicators={t.applicators}
        />
      </>
    )}
  </div>;
}