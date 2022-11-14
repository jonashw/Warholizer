import { ImagePayload } from "./applyImageThreshold";

const ImageGrid = ({
    img,
    rowSize,
    getBackgroundColor
  }:{
    img:ImagePayload,
    rowSize: number,
    getBackgroundColor: (i: number) => string | undefined
  }) =>
    <div>
      <style>
        {`
        .frame > .img {
          background-image: url(${img.dataUrl});
          aspect-ratio: ${(img.width/img.height)};
          max-width:100%;
          mix-blend-mode:darken;
          background-size:contain;
        }
      `}</style>
      <div style={{"display":"flex", "flexWrap":"wrap"}}>
        {Array(100).fill(null).map((_,i) => 
          <div key={i} className="frame" style={{
              width:`${100/rowSize}%`,
              backgroundColor: getBackgroundColor(i)
          }}>
            <div className="img" key={i}/>
          </div>
        )}
      </div>
    </div>;

export default ImageGrid;