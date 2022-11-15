import React from 'react';
import onFilePaste from './onFilePaste';
import {applyImageThreshold,ImagePayload,crop as cropImg, Cropping} from './ImageUtil';
import "./Warholizer.css";
import PrintPreview from './PrintPreview';
import fileToDataUrl from '../fileToDataUrl';
import FloatingActionButton from './FloatingActionButton';
import { PAPER, Paper } from './Paper';
import OffCanvas from './OffCanvas';
import ReactCrop, { Crop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

const colors = ["#ffff00", "#ff00ff", "#00ff00","#6666ff"];

const randomColors = Array(100).fill(undefined).map(_ => 
  colors[Math.floor(Math.random() * colors.length)]);

const bgcolorOptions: {label: string, getColor: (i: number) => string}[] = [
  {label: 'None', getColor: i => 'transparent'},
  {label: 'Sequential', getColor: i => colors[i % colors.length]},
  {label: 'Random', getColor: i => randomColors[Math.floor(i % randomColors.length)]}
];

const Warholizer = ({
	initialImgSrc,
	initialThreshold,
	initialRowSize,
	initialThresholdIsInEffect
} : {
  initialImgSrc: string;
  initialThreshold: number;
  initialRowSize: number;
  initialThresholdIsInEffect: boolean | undefined;
}) => {

  const [cropping, setCropping] = React.useState<Cropping>({
    crop: {x:0,y:0,width:0,height:0,unit:'px'},
    adjustRatio: {x:1, y:1}
  });
  let [paper,setPaper] = React.useState<Paper>(PAPER.LETTER_PORTRAIT);
  let [imgSrc,setImgSrc] = React.useState<string>(initialImgSrc);
	let [thresholdIsInEffect, setThresholdIsInEffect] = React.useState<boolean>(initialThresholdIsInEffect === undefined ? true : initialThresholdIsInEffect)
  let [colorAdjustedImg,setColorAdjustedImg] = React.useState<ImagePayload|undefined>();
  let [croppedImg,setCroppedImg] = React.useState<ImagePayload|undefined>();
  const [rowSize, setRowSize] = React.useState(initialRowSize || 5);
  const [threshold, setThreshold] = React.useState(initialThreshold || 122);
  const [selectedBGColorOption, setSelectedBGColorOption] = React.useState(bgcolorOptions[0]);
  const [settingsVisible,setSettingsVisible] = React.useState(false);
  const [wholeTilesOnly,setWholeTilesOnly] = React.useState(true);
  const cropImgRef = React.createRef<HTMLImageElement>();

  React.useEffect(() => {
    onFilePaste((data: ArrayBuffer | string) => {
      setImgSrc(data.toString());
      console.log('image paste');
    });
  }, []);

  React.useEffect(() => {
    const effect = async () => {
      const img = await applyImageThreshold(threshold, imgSrc);
      const src = thresholdIsInEffect ? img.modified : img.original;
      setColorAdjustedImg(src);
      console.log('image threshold');
    }
    effect();
  }, [threshold,imgSrc,thresholdIsInEffect]);

  React.useEffect(() => {
    const effect = async () => {
      if(!colorAdjustedImg){
        setCroppedImg(undefined);
        return;
      }
      const img = 
        !cropping || cropping.crop.width === 0 || cropping.crop.height === 0
        ? colorAdjustedImg
        : await cropImg(colorAdjustedImg, cropping);
      setCroppedImg(img);
      console.log('crop');
      //console.log('crop',img);
    }
    effect();
  }, [colorAdjustedImg,cropping]);

  return (
    <div>
      <FloatingActionButton 
        i={1}
        className={"btn " + (settingsVisible ? "btn-light" : "btn-secondary")}
        onClick={() => setSettingsVisible(!settingsVisible  ) }
      >
        <img alt="print" src={settingsVisible?"/settings.svg":"/settings-white.svg"} style={{width:'1.5em'}}/>
      </FloatingActionButton>
      <FloatingActionButton 
        i={0}
        className="btn btn-success"
        onClick={() => window.print() }
      >
        <img alt="print" src="/print-white.svg" style={{width:'1.5em'}}/>
      </FloatingActionButton>

      <OffCanvas title="Warholizer Settings" style={{background:'rgba(255,255,255,0.95'}} open={settingsVisible} setOpen={setSettingsVisible} >
        {colorAdjustedImg && cropping
          ?
          <div className="mb-3">
            <ReactCrop crop={cropping.crop} onChange={c => {
              /* The ReactCrop component pays no mind to the automatic scaling that may occur when cropping a large image.
              ** Its coordinate space respects the scaled image, not the original.  
              ** We should retain the original for optimal quality in our end artwork, so we must provide x/y adjustment ratios
              ** to enable accurate cropping of the original image.  */
              if(!cropImgRef.current){
                return;
              }
              let img = cropImgRef.current;
              setCropping({
                crop: c,
                adjustRatio: {
                  x: img.naturalWidth/img.width,
                  y: img.naturalHeight/img.height
                }
              });
            }}>
              <img src={colorAdjustedImg.dataUrl} alt="preview" ref={cropImgRef}/>
            </ReactCrop>

            <a href="/" onClick={e => {
              e.preventDefault();
              setColorAdjustedImg(undefined);
            }}>
              Clear
            </a>
          </div>
        : 
          <div className="mb-3">
            <label htmlFor="formFileUpload" className="form-label">
              File Upload
              <br/>(or just paste an image from your clipboard)
            </label>
            <input type="file" id="formFileUpload" onChange={async e => {
              var files = Array.from(e.target.files || []);
              if (files.length !== 1) {
                return;
              }
              let dataUrl: string | ArrayBuffer = await fileToDataUrl(files[0]);
              setImgSrc(dataUrl.toString());
            }} accept="image/*" />
          </div>
        }
        <div className="form-check form-switch mb-3">
          <input className="form-check-input" type="checkbox" defaultChecked={thresholdIsInEffect} onChange={e => setThresholdIsInEffect(!!e.target.checked)} id="formThresholdOn"/>
          <label className="form-check-label" htmlFor="formThresholdOn">
            Make black &amp; White 
          </label>
        </div>
        {!!thresholdIsInEffect && <div className="mb-3">
          <label htmlFor="formThreshold" className="form-label">
            Black &amp; White threshold
            ({threshold})
          </label>
          <input id="formThreshold" className="form-range" disabled={!thresholdIsInEffect} type="range" min="0" max="255" defaultValue={threshold} onChange={e => setThreshold(parseInt(e.target.value))} />
        </div>}

        <div className="mb-3">
          <label htmlFor="formRowLength" className="form-label">
            Row Length ({rowSize})
          </label>
          <input type="range" min="1" max="10"
          className="form-range"
          id="formRowLength" defaultValue={rowSize} onChange={e => setRowSize(parseInt(e.target.value))} />
        </div>

        <div className="form-check form-switch mb-3">
          <input className="form-check-input" type="checkbox" defaultChecked={wholeTilesOnly} onChange={e => setWholeTilesOnly(!!e.target.checked)} id="formWholeTilesOnly"/>
          <label className="form-check-label" htmlFor="formWholeTilesOnly">
            Whole rows only
          </label>
        </div>

        <label className="form-label">Background Colors</label>
        {bgcolorOptions.map((o,i) =>
          <div className="form-check" key={i}>
            <input
              className="form-check-input"
              type="radio"
              id={'form-bgcolor-' + i}
              value={o.label} 
              name="bgcolor"
              defaultChecked={selectedBGColorOption === o}
              onChange={e => {
                if (!e.target.checked) {
                  return;
                }
                setSelectedBGColorOption(o);
              }}
            />
            <label className="form-check-label" htmlFor={'form-bgcolor-' + i}>
              {o.label}
            </label>
          </div>)
        }

        <label className="form-label">Paper</label>
        {Object.values(PAPER).map(p =>
          <div className="form-check" key={p.cssSize}>
            <input
              className="form-check-input"
              id={"form-paper-" + p.cssSize}
              type="radio"
              name="paper"
              value={p.label}
              defaultChecked={paper === p}
              onChange={e => {
                if (!e.target.checked) {
                  return;
                }
                setPaper(p);
              }}
            />
            <label htmlFor={"form-paper-" + p.cssSize} className="form-label">
              {p.label}
            </label>
          </div>)} 
        
      </OffCanvas>
      
      {croppedImg && 
        <div className="centralizer">
          <PrintPreview
            paper={paper}
            img={croppedImg}
            rowSize={rowSize}
            wholeTilesOnly={wholeTilesOnly}
            getBackgroundColor={selectedBGColorOption.getColor} 
          />
        </div>
      }
    </div>
  );
};

export default Warholizer;