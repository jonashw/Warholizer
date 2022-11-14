import React from 'react';
import onFilePaste from './onFilePaste';
import {applyImageThreshold,ImagePayload} from './applyImageThreshold';
import "./Warholizer.css";
import PrintPreview from './PrintPreview';
import fileToDataUrl from '../fileToDataUrl';
import FloatingActionButton from './FloatingActionButton';
import { PAPER, Paper } from './Paper';
import OffCanvas from './OffCanvas';

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
  let [paper,setPaper] = React.useState<Paper>(PAPER.LETTER_PORTRAIT);
  let [imgSrc,setImgSrc] = React.useState<string>(initialImgSrc);
	let [thresholdIsInEffect, setThresholdIsInEffect] = React.useState<boolean>(initialThresholdIsInEffect === undefined ? true : initialThresholdIsInEffect)
  let [processedImg,setProcessedImg] = React.useState<ImagePayload|undefined>();
  const [rowSize, setRowSize] = React.useState(initialRowSize || 5);
  const [threshold, setThreshold] = React.useState(initialThreshold || 122);
  const colors = ["#ffff00", "#ff00ff", "#00ff00","#6666ff"];
  let bgcolorOptions: {label: string, getColor: (i: number) => string}[] = [
    {label: 'None', getColor: i => 'transparent'},
    {label: 'Sequential', getColor: i => colors[i % colors.length]},
    {label: 'Random', getColor: i => colors[Math.floor(Math.random() * colors.length)]}
  ];
  const [selectedBGColorOption, setSelectedBGColorOption] = React.useState(bgcolorOptions[0]);
  const [settingsVisible,setSettingsVisible] = React.useState(false);

  React.useEffect(() => {
    onFilePaste((data: ArrayBuffer | string) => {
      setImgSrc(data.toString());
    });
  }, []);

  React.useEffect(() => {
    const effect = async () => {
      const img = await applyImageThreshold(threshold, imgSrc);
      const src = thresholdIsInEffect ? img.modified : img.original;
      setProcessedImg(src);
    }
    effect();
  }, [threshold,imgSrc,thresholdIsInEffect])


  return (
    <div>
      <FloatingActionButton 
        i={1}
        className={"btn " + (settingsVisible ? "btn-outline-secondary" : "btn-secondary")}
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
      <OffCanvas title="Settings" style={{background:'rgba(255,255,255,0.95'}} open={settingsVisible} setOpen={setSettingsVisible} >
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
        <div className="mb-3">
          <label htmlFor="formRowLength" className="form-label">
            Row Length ({rowSize})
          </label>
          <input type="range" min="1" max="10"
          className="form-range"
          id="formRowLength" defaultValue={rowSize} onChange={e => setRowSize(parseInt(e.target.value))} />
        </div>
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

        <label className="form-label">Background Colors</label>
        {bgcolorOptions.map((o,i) =>
          <div className="form-check">
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
          <div className="form-check">
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
      
      {processedImg && 
        <div className="centralizer">
          <PrintPreview
            paper={paper}
            img={processedImg}
            rowSize={rowSize}
            getBackgroundColor={selectedBGColorOption.getColor} 
          />
        </div>
      }
    </div>
  );
};

export default Warholizer;