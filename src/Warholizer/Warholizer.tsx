import React from 'react';
import onFilePaste from './onFilePaste';
import {applyImageValueRanges,ImagePayload,crop as cropImg, Cropping, text, load, thresholdsToRanges, ValueRange } from './ImageUtil';
import "./Warholizer.css";
import PrintPreview from './PrintPreview';
import fileToDataUrl from '../fileToDataUrl';
import FloatingActionButton from './FloatingActionButton';
import { PAPER, Paper } from './Paper';
import OffCanvas from './OffCanvas';
import ReactCrop from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import Fonts from './Fonts';
import { tilingPatterns, defaultTilingPattern,  TILINGPATTERN} from './TilingPattern';

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
  const [thresholds, setThresholds] = React.useState<number[]>([initialThreshold || 122]);
  const [selectedBGColorOption, setSelectedBGColorOption] = React.useState(bgcolorOptions[0]);
  const [ranges,setRanges] = React.useState<ValueRange[]>([]);

  const offCanvasIsVisible = (id: string) => !!offCanvasVisible[id];

  const toggleOffCanvas = (id: string) => {
    setOffCanvasVisible({[id]: !offCanvasIsVisible(id)})
  };

  const [offCanvasVisible,setOffCanvasVisible] = React.useState<{[id:string]: boolean}>({
    settings: false,
    aspectRatio: false
  });

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
      const ranges = thresholdsToRanges(thresholds);
      setRanges(ranges);
    }
    effect();
  }, [thresholds]);

  React.useEffect(() => {
    const effect = async () => {
      if(!originalImg){
        setColorAdjustedImg(undefined);
        return;
      }
      const img = await applyImageValueRanges(ranges, originalImg);
      const src = thresholdIsInEffect ? img.modified : img.original;
      setColorAdjustedImg(src);
      console.log('image threshold');
    }
    effect();
  }, [ranges,originalImg,thresholdIsInEffect]);

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

  const fabs = 
  [
    {
      id:'inputImage',
      activeClass: "btn-light",
      inactiveClass: "btn-secondary",
      iconFile:'/photo.svg'
    },
    {
      id:'aspectRatio',
      activeClass: "btn-light",
      inactiveClass: "btn-secondary",
      iconFile:'/aspect-ratio.svg'
    },
    {
      id:'color',
      activeClass: "btn-light",
      inactiveClass: "btn-secondary",
      iconFile:'/palette.svg'
    },
    {
      id:'tilingPattern',
      activeClass: "btn-light",
      inactiveClass: "btn-secondary",
      iconFile:'/grid-view.svg'
    },

    /*


    */
  ];

  return (
    <div>
      <FloatingActionButton 
        i={0}
        className="btn btn-success"
        onClick={() => window.print() }
      >
        <img alt="print" src="/print.svg" style={{width:'1.5em',filter:'invert(1)'}}/>
      </FloatingActionButton>

      {fabs.map((fab,i) => 
        <FloatingActionButton 
          key={i}
          i={fabs.length-i}
          className={"btn " + (offCanvasIsVisible(fab.id) ? "btn-light" : "btn-secondary")}
          onClick={() => toggleOffCanvas(fab.id) }
        >
          <img alt="print" src={fab.iconFile} style={{
            width:'1.5em',
            filter: offCanvasIsVisible(fab.id) ? 'invert(0)' : 'invert(1)'
          }}/>
        </FloatingActionButton>
      )}


      <OffCanvas title="Tiling Patterns" style={{background:'rgba(255,255,255,0.95'}} open={offCanvasIsVisible('tilingPattern')} setOpen={() => toggleOffCanvas('tilingPattern')} >
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
      </OffCanvas>

      <OffCanvas title="Paper Size" style={{background:'rgba(255,255,255,0.95'}} open={offCanvasIsVisible('aspectRatio')} setOpen={() => toggleOffCanvas('aspectRatio')} >
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

      <OffCanvas title="Input Image" style={{background:'rgba(255,255,255,0.95'}} open={offCanvasIsVisible('inputImage')} setOpen={() => toggleOffCanvas('inputImage')} >
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
              setOriginalImg(undefined);
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

      <OffCanvas title="Color" style={{background:'rgba(255,255,255,0.95'}} open={offCanvasIsVisible('color')} setOpen={() => toggleOffCanvas('color')} >
        <div className="mb-3">
          <div className="form-check form-switch mb-3">
            <input className="form-check-input" type="checkbox" defaultChecked={thresholdIsInEffect} onChange={e => setThresholdIsInEffect(!!e.target.checked)} id="formThresholdOn"/>
            <label className="form-check-label" htmlFor="formThresholdOn">
              Make Grayscale
            </label>
          </div>
          {!!thresholdIsInEffect && <div className="mb-3">
            {thresholds.map((threshold,t) => 
              <div key={t}>
                <label htmlFor="formThreshold" className="form-label">
                  Value Threshold
                  ({threshold})
                </label>
                <button onClick={() => {
                  setThresholds(thresholds.filter((_,ti) => ti !== t));
                }} className="btn btn-outline-danger btn-sm float-end">
                  Remove
                </button>
                <input id="formThreshold" className="form-range" disabled={!thresholdIsInEffect} type="range" min="0" max="255" defaultValue={threshold} 
                  onChange={e => {
                    let newThresholds = [...thresholds];
                    newThresholds[t] = parseInt(e.target.value);
                    setThresholds(newThresholds);
                  }}
                />
              </div>
            )}
            <button 
            className="btn btn-primary"
            onClick={() => setThresholds([...thresholds,180])}>+ Threshold</button>
          </div>}
          {!!colorAdjustedImg && <img src={colorAdjustedImg.dataUrl} alt="preview" className="img-fluid"/>}
        </div>          
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