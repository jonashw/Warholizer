import React from 'react';
import onFilePaste from './onFilePaste';
import {applyImageThreshold,ImagePayload,crop as cropImg, Cropping, text, load, adjustTiling} from './ImageUtil';
import "./Warholizer.css";
import PrintPreview from './PrintPreview';
import fileToDataUrl from '../fileToDataUrl';
import FloatingActionButton from './FloatingActionButton';
import { PAPER, Paper } from './Paper';
import OffCanvas from './OffCanvas';
import ReactCrop from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import Fonts from './Fonts';
import {Position, Offset, TilingPattern, tilingPatterns, defaultTilingPattern,  TILINGPATTERN} from './TilingPattern';

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
  const [fontPreviewText, setFontPreviewText] = React.useState<string>('');
  const defaultCropping: Cropping = React.useMemo(() => ({
    crop: {x:0,y:0,width:0,height:0,unit:'px'},
    adjustRatio: {x:1, y:1}
  }),[]);
  const [cropping, setCropping] = React.useState<Cropping>(defaultCropping);
  let [paper,setPaper] = React.useState<Paper>(PAPER.LETTER_PORTRAIT);
	let [thresholdIsInEffect, setThresholdIsInEffect] = React.useState<boolean>(initialThresholdIsInEffect === undefined ? true : initialThresholdIsInEffect)
  let [colorAdjustedImg,setColorAdjustedImg] = React.useState<ImagePayload|undefined>();
  const [tilingPatternId,setTilingPatternId] = React.useState<string>(defaultTilingPattern.id);
  let [originalImg,setOriginalImg] = React.useState<ImagePayload|undefined>();
  let [croppedImg,setCroppedImg] = React.useState<ImagePayload|undefined>();
  const [rowSize, setRowSize] = React.useState(initialRowSize || 5);
  const [threshold, setThreshold] = React.useState(initialThreshold || 122);
  const [selectedBGColorOption, setSelectedBGColorOption] = React.useState(bgcolorOptions[0]);
  const [settingsVisible,setSettingsVisible] = React.useState(false);
  const [wholeTilesOnly,setWholeTilesOnly] = React.useState(false);
  const cropImgRef = React.createRef<HTMLImageElement>();
  const [fonts,setFonts] = React.useState<string[]>([]);

  React.useEffect(() => {
    const effect = async () => {
      let img = await load(initialImgSrc);
      setOriginalImg(img);
    }
    effect();
  }, [initialImgSrc]);

  React.useEffect(() => {
    const effect = async () => {
      let fonts: string[] = await Fonts.loadAll();
      setFonts(fonts);
    }
    effect();
  }, []);

  React.useEffect(() => {
    onFilePaste(async (data: ArrayBuffer | string) => {
      let img = await load(data.toString());
      setOriginalImg(img);
      console.log('image paste');
    });
  }, []);

  React.useEffect(() => {
    setCropping(defaultCropping);
  },[originalImg,defaultCropping]);

  React.useEffect(() => {
    const effect = async () => {
      if(!originalImg){
        setColorAdjustedImg(undefined);
        return;
      }
      const img = await applyImageThreshold(threshold, originalImg);
      const src = thresholdIsInEffect ? img.modified : img.original;
      setColorAdjustedImg(src);
      console.log('image threshold');
    }
    effect();
  }, [threshold,originalImg,thresholdIsInEffect]);

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

      const tileAdjustedImage = 
        img;//await adjustTiling(img, TILINGPATTERN[tilingPatternId]);

      setCroppedImg(tileAdjustedImage);
      console.log('crop');
      //console.log('crop',img);
    }
    effect();
  }, [colorAdjustedImg,cropping,tilingPatternId]);

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
            <label className="form-label">Tiling Pattern</label>
            {tilingPatterns.map(tp =>
              <div className="form-check" key={tp.label}>
                <input
                  className="form-check-input"
                  id={"form-tiling-pattern-" + tp.id}
                  type="radio"
                  name="tiling-pattern"
                  value={tp.label}
                  defaultChecked={tilingPatternId === tp.id}
                  onChange={e => {
                    if (!e.target.checked) {
                      return;
                    }
                    setTilingPatternId(tp.id);
                  }}
                />
                <label htmlFor={"form-tiling-pattern-" + tp.id} className="form-label">
                  {tp.label}
                </label>
              </div>)} 

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
              setOriginalImg(undefined);
            }}>
              Clear
            </a>
            <div className="my-3">
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
              setOriginalImg(await load(dataUrl.toString()));
            }} accept="image/*" />
            <div className="mt-3">
              <label htmlFor="formFileUpload" className="form-label">
                Text and font
              </label>
              <input
                id="formText"
                className="form-control"
                type="text" value={fontPreviewText} onChange={e => {
                  e.preventDefault();
                  setFontPreviewText(e.target.value);
                }}
              />
              <div style={{maxHeight:'200px', overflowY:'auto', border:'1px solid #ddd', background:'white'}}>
              {fonts.map((f,fi) => 
                <div
                  style={{fontFamily:f,fontSize:'24px', textAlign:'center'}}
                  key={f} 
                  onClick={async _ => {
                    //setFonts(fonts => fonts.filter((_,ffi) => ffi !== fi));
                    let textToDraw = !!fontPreviewText ? fontPreviewText : f;
                    let img = await text(` ${textToDraw} `, f, 320);
                    setCropping(defaultCropping);
                    setOriginalImg(img);
                  }}
                >
                  {!!fontPreviewText ? fontPreviewText : f}
                </div>)}
              </div>
            </div>
          </div>
        }

        
      </OffCanvas>
      
      {croppedImg && 
        <div className="centralizer">
          <PrintPreview
            tilingPattern={TILINGPATTERN[tilingPatternId]}
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