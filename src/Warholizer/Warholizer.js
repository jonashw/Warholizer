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
  const colors = ["#ffff00", "#ff00ff","#00ffff"];
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

  return (
    <div>
      <table id="settings-table">
        <tr>
          <th>Row size</th>
          <td>
            <input type="range" min="2" max="20" defaultValue={rowSize} onChange={e => setRowSize(parseInt(e.target.value))}/>
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
            <label>
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
      </table>
      
      <div style={{"display":"flex", "flexWrap":"wrap"}}>
        {Array(300).fill(processedImgSrc).map((src,i) => 
        	<div className="frame" style={{
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