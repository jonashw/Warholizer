import React from 'react';
import onFilePaste from './onFilePaste';
import applyImageThreshold from './applyImageThreshold';
import "./Warholizer.css";

const Warholizer = ({
	initialImgSrc,
	initialThreshold,
	initialRowSize,
	initialThresholdIsInEffect
}) => {
  let [imgSrc,setImgSrc] = React.useState(initialImgSrc);
	let [thresholdIsInEffect, setThresholdIsInEffect] = React.useState(initialThresholdIsInEffect === undefined ? true : initialThresholdIsInEffect)
  let [processedImgSrc,setProcessedImgSrc] = React.useState(imgSrc);
  const [rowSize, setRowSize] = React.useState(initialRowSize || 5);
  const [threshold, setThreshold] = React.useState(initialThreshold || 122);
  const colors = ["#ffff00", "#ff00ff", "#00ff00","#6666ff"];
  let bgcolorOptions = [
    {label: 'None', getColor: i => 'transparent'},
    {label: 'Sequential', getColor: i => colors[i % colors.length]},
    {label: 'Random', getColor: i => colors[Math.floor(Math.random() * colors.length)]}
  ];
  const [selectedBGColorOption, setSelectedBGColorOption] = React.useState(bgcolorOptions[0]);

  React.useEffect(() => {
    onFilePaste(window, data => {
      setImgSrc(data);
    });
  }, []);

  React.useEffect(() => {
    const effect = async () => {
      let bw = await applyImageThreshold(threshold, imgSrc);
      setProcessedImgSrc(thresholdIsInEffect ? bw : imgSrc);
    }
    effect();
  }, [threshold,imgSrc,thresholdIsInEffect])

  const fileToDataUrl = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });

  const onFileChange = async e => {
    var files = Array.from(e.target.files);
    if (files.length !== 1) {
      return;
    }
    let dataUrl = await fileToDataUrl(files[0]);
    setImgSrc(dataUrl);
  };

  return (
    <div>
      <table id="settings-table">
        <tbody>
          <tr>
            <th>
              File upload
            </th>
            <td>
              <input type="file" onChange={onFileChange} accept="image/*"/>
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
      
      <div style={{"display":"flex", "flexWrap":"wrap"}}>
        {Array(300).fill(processedImgSrc).map((src,i) => 
        	<div key={i} className="frame" style={{
              width:`${100/rowSize}%`,
              backgroundColor: selectedBGColorOption.getColor(i)
          }}>
            <img alt={src} key={i} src={src} style={{
              maxWidth:'100%',
              mixBlendMode:'darken'
            }}/>
          </div>
        )}
      </div>
    </div>
  );
};

export default Warholizer;