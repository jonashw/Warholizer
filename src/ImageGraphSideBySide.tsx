import React from 'react';
import { WarholizerImage, WarholizerImageRef } from './WarholizerImage';
import { PureRasterApplicatorRecord } from './Warholizer/RasterOperations/PureRasterApplicator';
import { DagMode } from './GraphViewerDemo';
import { ImageRecord } from './ImageRecord';
import { ApplicatorGraph } from './applicatorGraph';

export function ImageGraphSideBySide({
  applicators,
  dagMode, 
  inputs
}: {
  applicators: PureRasterApplicatorRecord[];
  dagMode: DagMode;
  inputs: ImageRecord[]
}) {
  const ref = React.createRef<WarholizerImageRef>();
  const graphHeight = 500;
  return (
    <div className="row">
      <div className="col-md-6">
        <WarholizerImage
          ref={ref}
          src={inputs}
          className="img-fluid"
          transform={applicators} />
      </div>

      <div className="col-md-6">
        <ApplicatorGraph
          dagMode={dagMode}
          height={graphHeight}
          inputs={inputs}
          applicators={applicators}
          relateOpsBetweenApps={false}
        />
      </div>
    </div>
  );
}