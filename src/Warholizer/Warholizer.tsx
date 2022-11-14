import React from 'react';
import onFilePaste from './onFilePaste';
import {applyImageThreshold,ImagePayload} from './applyImageThreshold';
import "./Warholizer.css";
import ImageGrid from './ImageGrid';
import fileToDataUrl from '../fileToDataUrl';

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

  React.useEffect(() => {
    onFilePaste(window, (data: string) => {
      setImgSrc(data);
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
      <table id="settings-table">
        <tbody>
          <tr>
            <th>
              File upload
            </th>
            <td>
              <input type="file" onChange={async e => {
                var files = Array.from(e.target.files || []);
                if (files.length !== 1) {
                  return;
                }
                let dataUrl: string | ArrayBuffer = await fileToDataUrl(files[0]);
                setImgSrc(dataUrl.toString());
              }} accept="image/*"/>
              (or just paste an image from your clipboard)
            </td>
          </tr>
          <tr>
            <th>Row size</th>
            <td>
              <input type="range" min="1" max="20" defaultValue={rowSize} onChange={e => setRowSize(parseInt(e.target.value))}/>
              ({rowSize})
            </td>
          </tr>
          <tr>
            <th>
              B/W threshold
            </th>
            <td>
              <input type="checkbox" defaultChecked={thresholdIsInEffect} onChange={e => setThresholdIsInEffect(!!e.target.checked)} />
              <input disabled={!thresholdIsInEffect} type="range" min="0" max="255" defaultValue={threshold} onChange={e => setThreshold(parseInt(e.target.value))}/>
              ({threshold})
            </td>
          </tr>
          <tr>
            <th>BG colors</th>
            <td>
            {bgcolorOptions.map(o => 
              <label key={o.label}>
                <input
                  type="radio"
                  name="bgcolor"
                  value={o.label}
                  defaultChecked={selectedBGColorOption === o}
                  onChange={e => {
                    if(!e.target.checked){
                      return;
                    }
                    setSelectedBGColorOption(o);
                  }}
                />
                {o.label}
              </label>)}
              </td>
          </tr>
        </tbody>
      </table>
      {processedImg && 
        <ImageGrid
          img={processedImg}
          rowSize={rowSize}
          getBackgroundColor={selectedBGColorOption.getColor} 
        />
      }
    </div>
  );
};

export default Warholizer;