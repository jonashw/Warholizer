import React from "react";
import { ImagePayload } from "./ImageUtil";
import { Paper } from "./Paper";
import useWindowSize from "./useWindowSize";
import "./PrintPreview.css";
import { TilingPattern } from "./TilingPattern";

const ImageGrid = ({
    img,
    rowSize,
    getBackgroundColor,
    paper,
    wholeTilesOnly,
    tilingPattern
  }:{
    img:ImagePayload,
    rowSize: number,
    getBackgroundColor: (i: number) => string | undefined,
    paper: Paper,
    wholeTilesOnly: boolean,
    tilingPattern: TilingPattern
  }) => {
    const [WH,setWH] = React.useState({w:0,h:0});
    const [scale,setScale] = React.useState(.6);
    const windowSize = useWindowSize();

    React.useEffect(() => {
      if(!windowSize){
        return;
      }
      let ar = (img.width)/(img.height);
      let w = (paper.width/rowSize);
      let h = w/ar;
      setWH({w,h});
      setScale(
        Math.min(
        windowSize.height/(paper.height+50),
        windowSize.width/(paper.height+50)));
    }, [
      img,
      getBackgroundColor,
      windowSize,

      rowSize,
      paper
    ]);

    const infinityAsZero = (n: number): number => n === Infinity ? 0 : n;
    let {w,h} = WH;
    const canvasW = w*rowSize;
    const canvasH = canvasW/paper.AR;
    const colSize = infinityAsZero(Math.ceil(canvasH/h) || 0);

    return <div style={{
      height: (paper.height * scale)+'px',
      width: (paper.width*scale) + 'px',
      margin:'5px auto'
    }} className="print-preview">
      <style>
        {`
          @page {
            margin: 0;
            size: ${paper.cssSize}
          }
          .frame,
          .frame .img {
            width:${w}px;
            height:${h}px;
          }
          .frame .img {
            background-image: url(${img.dataUrl});
            background-size: ${w}px ${h}px;
          }
          .canvas-row {
            display: flex;
          }
          ${tilingPattern.flips.map(f => `
            .canvas-row:nth-child(${f.rowSelector}) .frame:nth-child(${f.colSelector}) > .img {
              transform: scale(${f.x ? -1 : 1},${f.y ? -1 : 1});
            }
          `).join('\n')}
          .canvas-row:nth-child(${tilingPattern.nthRow}) > .frame:nth-child(${tilingPattern.nthCol}) > .img {
            background-position-${tilingPattern.offsetDimension}: -${tilingPattern.offset(w,h)}px;
          }
        `}
      </style>
      <div 
      className="canvas"
      style={{
        transform:`scale(${scale})`,
        transformOrigin:'0 0',
        width:canvasW + 'px',
        height: (wholeTilesOnly ? canvasH - (canvasH%h) : canvasH) + 'px'
      }}
      >
        {Array(colSize).fill(undefined).map((_,c) => 
          <div className="canvas-row" key={c}>
            {Array(rowSize).fill(undefined).map((_,r) =>
              <div
                key={r}
                className="frame" 
                style={{ backgroundColor: getBackgroundColor(c*rowSize + r) }}
              >
                <div className="img"/>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  }

export default ImageGrid;