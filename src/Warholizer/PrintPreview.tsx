import React from "react";
import { ImagePayload } from "./applyImageThreshold";
import { Paper } from "./Paper";
import useWindowSize from "./useWindowSize";
import "./PrintPreview.css";

const ImageGrid = ({
    img,
    rowSize,
    getBackgroundColor,
    paper
  }:{
    img:ImagePayload,
    rowSize: number,
    getBackgroundColor: (i: number) => string | undefined,
    paper: Paper
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

    let {w,h} = WH;
    const canvasW = w*rowSize;
    const canvasH =canvasW/paper.AR; 

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
        `}
      </style>
      <div 
      className="canvas"
      style={{
        transform:`scale(${scale})`,
        transformOrigin:'0 0',
        width:canvasW + 'px',
        height:(canvasH - (canvasH%h)) + 'px',
        backgroundImage: `url(${img.dataUrl})`,
        backgroundSize: `${w}px ${h}px`
      }}
      >
        <div style={{"display":"flex", "flexWrap":"wrap"}}>
          {Array(200).fill(null).map((_,i) => 
            <div key={i} className="frame" style={{
                width:`${w}px`,
                height:`${h}px`,
                backgroundColor: getBackgroundColor(i)
            }}>
              <div className="img" key={i}/>
            </div>
          )}
        </div>
      </div>
    </div>
  }

export default ImageGrid;