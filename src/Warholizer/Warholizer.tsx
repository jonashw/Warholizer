import React from 'react';
import onFilePaste from './onFilePaste';
import {applyImageValueRanges,ImagePayload,crop as cropImg, Cropping, text, load, Quantization, quantize, MAX_QUANITIZATION_DEPTH, getValueHistogram} from './ImageUtil';
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
import { ValueRange, split } from './ValueRange';

const colors = ["#ffff00", "#ff00ff", "#00ff00","#6666ff",'#ff0000'];

const bgcolorOptions: {
  label: string, 
  getColor: (colors: string[], i: number) => string
}[] = [
  {label: 'None', getColor: () => 'transparent'},
  {label: 'Sequential', getColor: (colors,i) => colors[i % colors.length]},
  {label: 'Random', getColor: (colors, i) => colors[Math.floor(Math.random() * colors.length)]}
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
  const [bgColorPalette,setBgColorPalette] = React.useState(colors);
  const [fontPreviewText, setFontPreviewText] = React.useState<string>('');
  const defaultCropping: Cropping = React.useMemo(() => ({
    crop: {x:0,y:0,width:0,height:0,unit:'px'},
    adjustRatio: {x:1, y:1}
  }),[]);
  const [cropping, setCropping] = React.useState<Cropping>(defaultCropping);
  let [paper,setPaper] = React.useState<Paper>(PAPER.LETTER_PORTRAIT);
	let [thresholdIsInEffect, setThresholdIsInEffect] = React.useState<boolean>(initialThresholdIsInEffect === undefined ? true : initialThresholdIsInEffect)
  let [colorAdjustedImg,setColorAdjustedImg] = React.useState<ImagePayload|undefined>();
  const [quantization,setQuantization] = React.useState<Quantization|undefined>();
  const [quantizationDepth,setQuantizationDepth] = React.useState<number>(2);
  const [stencilMaskImgs,setStencilMaskImgs] = React.useState<ImagePayload[]>([]);
  const [valueHistogramImg,setValueHistogramImg] = React.useState<ImagePayload | undefined>();
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

  const [activeColorBucket, setActiveColorBucket] = React.useState<number|undefined>(undefined);
  const [offCanvasVisible,setOffCanvasVisible] = React.useState<{[id:string]: boolean}>({ });

  const [wholeTilesOnly,setWholeTilesOnly] = React.useState(false);
  const cropImgRef = React.createRef<HTMLImageElement>();
  const [fonts,setFonts] = React.useState<string[]>([]);
  const [replacementCSSColors,setReplacementCSSColors] = React.useState<string[]>([]);
  const [replacementColors,setReplacementColors] = React.useState<([number,number,number]|undefined)[]>([]);

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
      const ranges = split(
        {
          min:0,
          max:255,
          value: 0
        },
        thresholds);
      setRanges(ranges);
    }
    effect();
  }, [thresholds]);

  React.useEffect(() => {
    const effect = async () => {
      if(!croppedImg){
        setColorAdjustedImg(undefined);
        return;
      }
      const img = await applyImageValueRanges(ranges, croppedImg);
      const histo = await getValueHistogram(croppedImg);
      const src = thresholdIsInEffect ? img.modified : img.original;
      setColorAdjustedImg(src);
      setValueHistogramImg(histo);
      setStencilMaskImgs(img.stencilMasks);
      console.log('image threshold');
    }
    effect();
  }, [ranges,croppedImg,thresholdIsInEffect]);

  React.useEffect(() => {
    const effect = async () => {
      if(!croppedImg){
        setQuantization(undefined);
        return;
      }
      const q = await quantize(croppedImg,quantizationDepth,replacementColors);
      setQuantization(q);
    }
    effect();
  }, [quantizationDepth,croppedImg,replacementColors]);

  React.useEffect(() => {
    setReplacementColors([]);
    setReplacementCSSColors([]);
  },[croppedImg, quantizationDepth]);

  React.useEffect(() => {
    const effect = async () => {
      if(!originalImg){
        setCroppedImg(undefined);
        return;
      }
      const img = 
        !cropping || cropping.crop.width === 0 || cropping.crop.height === 0
        ? originalImg
        : await cropImg(originalImg, cropping);

      setCroppedImg(img);
      console.log('crop');
      //console.log('crop',img);
    }
    effect();
  }, [originalImg,cropping]);

  const fabs = 
  [
    {
      id:'inputImage',
      name: 'Input Image',
      activeClass: "btn-light",
      inactiveClass: "btn-secondary",
      iconFile:'/photo.svg'
    },
    {
      id:'color',
      name: 'Color',
      activeClass: "btn-light",
      inactiveClass: "btn-secondary",
      iconFile:'/palette.svg'
    },
    {
      id:'quantize',
      name: 'Quantize',
      activeClass: "btn-light",
      inactiveClass: "btn-secondary",
      iconFile:'/equalizer.svg'
    },
    {
      id:'tilingPattern',
      name: 'Tiling',
      activeClass: "btn-light",
      inactiveClass: "btn-secondary",
      iconFile:'/grid-view.svg'
    },
    {
      id:'aspectRatio',
      name: 'Aspect Ratio',
      activeClass: "btn-light",
      inactiveClass: "btn-secondary",
      iconFile:'/aspect-ratio.svg'
    },

    /*


    */
  ];

  return (
    <div>
      <FloatingActionButton 
        i={1}
        className="btn btn-success"
        onClick={() => window.print() }
      >
        <img alt="print" src="/print.svg" style={{width:'1.5em',filter:'invert(1)'}}/>
      </FloatingActionButton>

    <div className="navbar navbar-dark bg-dark" style={{
        position:'fixed',
        bottom:'0',
        left:0,
        right:0,
        zIndex: 5000,
        boxShadow:'0 0 10px black'
    }}>
      <ul className="nav nav-pills nav-fill" style={{width:'100%'}}>
        {fabs.map((fab,i) => 
          <li className="nav-item" key={i}>
            <a 
            className={"nav-link" + (offCanvasIsVisible(fab.id) ? " active" : "")}
            onClick={e => {
              e.preventDefault();
              toggleOffCanvas(fab.id);
            }}
            aria-current="page" href="/">
              <img alt="print" src={fab.iconFile} style={{
                width:'1.5em',
                filter: offCanvasIsVisible(fab.id) ? 'invert(0)' : 'invert(1)'
              }}/>
              <div className="text-light d-none d-sm-block">
                {fab.name}
              </div>
            </a>
          </li>
        )}
      </ul>
    </div>

    <OffCanvas title="Tiling Patterns" style={{background:'rgba(255,255,255,0.95'}} open={offCanvasIsVisible('tilingPattern')} setOpen={() => toggleOffCanvas('tilingPattern')} >
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

        <label className="form-label mt-3">Background Color Palette</label>
        <div className="d-flex justify-content-around">
          {colors.map(c => {
            const id = `bg-color-palette-${c.replace('#','')}`;
            return <div key={c}>
              <label
                htmlFor={id}
                style={{
                  display:'inline-block',
                  lineHeight:'1em',
                  height:'1em',
                  width:'1em',
                  background:c,
                  border:'1px solid white',
                  padding:'1px',
                  margin:'1px',
                  boxShadow:'0 1px 3px #999'
                }}
              />
              <div>
                <input 
                  type="checkbox"
                  id={id}
                  checked={bgColorPalette.indexOf(c) > -1}
                  onChange={e => {
                    let nextValue = [...bgColorPalette];
                    if(e.target.checked){
                      nextValue.push(c);
                    } else {
                      nextValue = nextValue.filter(otherC => otherC !== c);
                    }
                    setBgColorPalette(nextValue);
                  }}
                  />
              </div>
            </div>;
          })}
        </div>
      </OffCanvas>

      <OffCanvas title="Input Image" style={{background:'rgba(255,255,255,0.95'}} open={offCanvasIsVisible('inputImage')} setOpen={() => toggleOffCanvas('inputImage')} >
        {originalImg && cropping
          ?
          <div className="card mb-3">
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
              <img src={originalImg.dataUrl} alt="preview" ref={cropImgRef}/>
            </ReactCrop>

            <div className="card-footer d-grid">
              <button className="btn btn-danger" onClick={_ => {
                setOriginalImg(undefined);
              }}>
                Clear
              </button>
            </div>
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
              {fonts.map((f,_) => 
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
          {!!valueHistogramImg && 
            <img src={valueHistogramImg!.dataUrl} 
              alt="Value histogram"
              title="Value histogram"
              className="img-fluid mb-4" 
              style={{width: '100%', border:'1px solid black'}}/> }
          <div className="form-check form-switch mb-3">
            <input className="form-check-input" type="checkbox" defaultChecked={thresholdIsInEffect} onChange={e => setThresholdIsInEffect(!!e.target.checked)} id="formThresholdOn"/>
            <label className="form-check-label" htmlFor="formThresholdOn">
              Make Grayscale
            </label>
          </div>
          {!!thresholdIsInEffect && <div className="mb-3">
            <label className="form-label">
              Value Threshold(s)
            </label>
            {thresholds.map((threshold,t) => 
              <div key={t} className="d-flex py-1">
                <input className="form-range" disabled={!thresholdIsInEffect} type="range" min="0" max="255" defaultValue={threshold} 
                  onChange={e => {
                    let newThresholds = [...thresholds];
                    newThresholds[t] = parseInt(e.target.value);
                    setThresholds(newThresholds);
                  }}
                />
                <span className="px-2">
                  {thresholds[t].toFixed(0)}
                </span>
                <button onClick={() => {
                  setThresholds(thresholds.filter((_,ti) => ti !== t));
                }} className="btn btn-outline-danger btn-sm">
                  Remove
                </button>
              </div>
            )}
            <div className="d-grid py-1">
              <button 
              className="btn btn-primary"
              onClick={() => {
                let nextThreshold = 
                  thresholds.length === 0 
                  ? 125 
                  : (255+thresholds[thresholds.length-1])/2;
                setThresholds([...thresholds, nextThreshold ]);
              }}>+ Threshold</button>
            </div>
            {!!colorAdjustedImg && <>
              <img src={colorAdjustedImg.dataUrl} alt="preview composite" className="img-fluid"/>
              <h5 className="my-3">
                Stencil masks ({stencilMaskImgs.length})
              </h5>
              <div className="row g-4">
                {stencilMaskImgs.map((img, i) =>
                  <div className="col-4" key={i}>
                    <div className="card mb-2">
                      <img src={img.dataUrl}
                        alt={"preview of range #" + (i + 1)}
                        className="card-img-top"/>
                      <div className="card-body text-center">
                        <div className="card-text">#{(i + 1)}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>}
          </div>}

        </div>          
      </OffCanvas>

      <OffCanvas title="Quantize" style={{background:'rgba(255,255,255,0.95'}} open={offCanvasIsVisible('quantize')} setOpen={() => toggleOffCanvas('quantize')} >
        <div className="mb-3">
          <div className="mb-3">
            <label className="form-label">
              Depth ({quantizationDepth})
            </label>
            <input
              className="form-range"
              type="range"
              min="1"
              step="1"
              max={MAX_QUANITIZATION_DEPTH}
              defaultValue={quantizationDepth} 
              onChange={e => {
                setQuantizationDepth(parseInt(e.target.value));
              }}
            />
            </div>
        </div>          

        <div className="d-flex text-center justify-content-between align-items-center mb-3">
          <div className="card mb-2">
            <img src={quantization?.original.dataUrl}
              className="card-img-top"
              alt="original img" 
            />
            <div className="card-body text-center">
              <div className="card-text">
                Original
                <div>
                  {quantization?.originalColorCount?.toLocaleString()} colors
                </div>
              </div>
            </div>
          </div>
          
          <div className="h2">&rarr;</div>

          <div className="card mb-2">
            <img src={quantization?.quantized.dataUrl}
              className="card-img-top"
              alt="quantized img" 
            />
            <div className="card-body text-center">
              <div className="card-text">
                Quantized
                <div>
                  {quantization?.colorBuckets.length} colors
                </div>
              </div>
            </div>
          </div>
        </div>

        <h6 className="mt-3">Quantized Color Pallette</h6>

        <div className="mb-3 d-flex flex-wrap">
          {quantization?.colorBuckets.map((bucket, _) =>
            <div className="pe-1 pb-1">
              <Swatch color={bucket.averageColorCSS} />
            </div>
          )}
        </div>

        <h6 className="mt-3">Color Replacement</h6>
        {quantization?.colorBuckets.map((bucket, i) =>
        <div className="py-1 d-flex justify-content-between align-items-center">
            <Swatch color={bucket.averageColorCSS} />
            <div className="h3 m-0">&rarr;</div>

            {!!replacementColors[i] 
              ? <Swatch color={'rgba(' + replacementColors[i] + ')'} />
              : <span>N/A</span>
            }

            <input type="text"
              style={{width:'unset'}}
              className="form-control form-control-sm flex-shrink-1"
              defaultValue={!!replacementCSSColors[i] ? replacementCSSColors[i] : ""} 
              onChange={e => {
                let colorString = e.target.value?.trim() || "";
                let rgb = 
                  colorString
                    .split(',')
                    .map(str => parseInt(str))
                    .filter(n => !isNaN(n) && 0 <= n && n <= 255);
                setReplacementColors(cs => {
                  let updatedColors = [...cs];
                  updatedColors[i] = rgb.length !== 3 ? undefined : (rgb as [number,number,number]);
                  return updatedColors;
                })
                setReplacementCSSColors(cs => {
                  let updatedColors = [...cs];
                  updatedColors[i] = rgb.length !== 3 ? "" : colorString;
                  return updatedColors;
                })
              }}
            />
          </div>
        )}

        <h6 className="mt-3">Color Buckets</h6>

        {quantization?.colorBuckets.map((bucket,i) =>
          <div className="d-flex align-items-center">
            <div className="card mb-2">
              <img src={bucket.original.dataUrl}
                alt={"preview of original bucket #" + (i + 1)}
                className="card-img-top"/>
              <div className="card-body text-center">
                <div className="card-text">Original #{(i + 1)}</div>
              </div>
            </div>

            <div className="text-center d-flex flex-column align-items-center justify-content-between ">
              Mask
              <Swatch color={bucket.averageColorCSS} />
              <div className="h2">
                &rarr;
              </div>
            </div>

            <div className="card mb-2"
              onMouseOver={() => setActiveColorBucket(i)}
              onMouseOut={() => setActiveColorBucket(undefined)}
            >
              <img src={i === activeColorBucket ? bucket.highlightedMask.dataUrl : bucket.masked.dataUrl}
                alt={"preview of masked bucket #" + (i + 1)}
                className="card-img-top"/>
              <div className="card-body text-center">
                <div className="card-text">Masked #{(i + 1)}</div>
              </div>
            </div>
          </div>
        )}

        <h6 className="h6">Reassembled Color Buckets <div className="text-muted">(should be identical to original)</div></h6>
        <img src={quantization?.reassembled.dataUrl} className="img-fluid img-thumbnail" alt="re-assembled img" />
      </OffCanvas>

      <OffCanvas
        title="Paper Aspect Ratio"
        style={{background:'rgba(255,255,255,0.95'}}
        open={offCanvasIsVisible('aspectRatio')}
        setOpen={() => toggleOffCanvas('aspectRatio')}
      >
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
        {!!croppedImg && <PrintPreview
          tilingPattern={TILINGPATTERN[tilingPatternId]}
          paper={paper}
          img={croppedImg}
          rowSize={rowSize}
          backgroundColorPalette={bgColorPalette}
          wholeTilesOnly={wholeTilesOnly}
          getBackgroundColor={selectedBGColorOption.getColor} 
        />}
      </OffCanvas>
      
      {colorAdjustedImg && 
        <div className="centralizer">
          <PrintPreview
            tilingPattern={TILINGPATTERN[tilingPatternId]}
            paper={paper}
            img={colorAdjustedImg}
            rowSize={rowSize}
            backgroundColorPalette={bgColorPalette}
            wholeTilesOnly={wholeTilesOnly}
            getBackgroundColor={selectedBGColorOption.getColor} 
          />
        </div>
      }
    </div>
  );
};

const Swatch = ({color} : {color: string}) => 
  <div className="card" style={{
    width:'32px',
    height:'32px',
    flexShrink:0,
    backgroundColor: color
  }}/>;

export default Warholizer;