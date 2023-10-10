import { Crop } from "react-image-crop";

export type Cropping = {crop: Crop, adjustRatio: {x: number, y: number}};
export type ImagePayload = {dataUrl: string; width:number; height: number};

const getTextHeight = (font: string, text: string) => {
  let textContainer = document.createElement('span');
  textContainer.style.font = font;
  textContainer.innerText = "Mg";
  let block = document.createElement('div');
  block.style.display="inline-block";
  block.style.width="1px";
  block.style.height="0px";

  let div = document.createElement('div');
  div.style.whiteSpace = "nowrap";
  div.appendChild(textContainer);
  div.appendChild(block);

  document.body.appendChild(div);

  let ascent = 0;
  let height = 0;
  let descent = 0;
  try {
    block.style.verticalAlign = 'baseline';
    ascent = block.offsetTop - textContainer.offsetTop;
    block.style.verticalAlign = 'bottom';
    height = block.offsetTop - textContainer.offsetTop;
    descent = height - ascent;
  } finally {
    div.remove();
  }

  return {ascent,height,descent};
};

var determineFontHeight = function(fontStyle: string) {
  var body = document.querySelector("body")!;
  var dummy = document.createElement("div");
  var dummyText = document.createTextNode("Mg");
  dummy.appendChild(dummyText);
  dummy.setAttribute("style", fontStyle);
  body.appendChild(dummy);
  var result = dummy.offsetHeight;
  body.removeChild(dummy);
  return result;
};

export const text = (text: string, font: string, sizeInPx: number): Promise<ImagePayload> => 
  new Promise((resolve,reject) => {
    let c = document.createElement('canvas');
    document.body.prepend(c);
    let ctx = c.getContext('2d')!;
    let cssFont = `${sizeInPx}px ${font}`;
    ctx.font = cssFont;

    let measurements = ctx.measureText(text);
    let textHeight = getTextHeight(cssFont,text).height;
    let textHeight2 = determineFontHeight(`font-family:${font}; font-size: ${sizeInPx}px;`);
    console.log(measurements.width, textHeight2, textHeight)
    //let marginPct = 1/16;
    c.width = measurements.width;
    c.height= textHeight2;
    //let margin = Math.max();
    //measurements.fontBoundingBoxAscent + measurements.fontBoundingBoxDescent;
    console.log(c.height, );
    //measurements.actualBoundingBoxAscent + measurements.actualBoundingBoxDescent;
    ctx = c.getContext('2d')!;
    
    //font and other settings reset after resizing the canvas
    ctx.font = `${sizeInPx}px ${font}`;

    ctx.fillStyle="white";
    ctx.textAlign = 'left';
    ctx.textBaseline='top';
    ctx.fillRect(0,0,c.width,c.height);
    ctx.fillStyle="black";
    ctx.strokeStyle="black";
    ctx.lineWidth=1;
    //ctx.strokeRect(1,1,c.width-2,c.height-2);
    ctx.fillText(text,0,0);
    resolve({
      dataUrl: c.toDataURL(),
      height: sizeInPx,
      width: measurements.width
    });
    c.remove();
  });

function editImage<T>(
  src: string,
  fn: (
    img: HTMLImageElement,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D
) => T): Promise<T> 
{
  return new Promise((resolve,reject) => {
    let img = new Image();
    img.onload = () => {
      let c = document.createElement('canvas');
      document.body.append(c);
      let ctx = c.getContext('2d')!;
      resolve(fn(img, c, ctx));
      c.remove();
    };
    img.src = src;
  });
}

export const load = (src: string): Promise<ImagePayload> =>
  editImage(src,(img,c,ctx) => {
    c.width = img.width;
    c.height = img.height;
    ctx.drawImage(img,0,0);
    return {
      dataUrl: c.toDataURL(),
      width: c.width,
      height: c.height
    };
});

export const crop = (img: ImagePayload, cropping: Cropping): Promise<ImagePayload> => 
  editImage(img.dataUrl, (img, c, ctx) => {
    let crop = cropping.crop;
    let ar = cropping.adjustRatio;
    c.width = crop.width*ar.x;
    c.height = crop.height*ar.y;
    ctx.drawImage(
      img,
      crop.x * ar.x, //sx
      crop.y * ar.y, //sy
      c.width, //sw
      c.height,//sh
      0,//dx
      0,//dy
      c.width,//dw
      c.height//dh
    );
    return {
      dataUrl: c.toDataURL(),
      width: c.width,
      height: c.height
    };
  });

export const applyImageThreshold = (
  threshold: number,
  originalImg: ImagePayload
): Promise<{
  modified:ImagePayload,
  original:ImagePayload
}> => 
  editImage(originalImg.dataUrl, (img, c, ctx) => {
    let [width,height] = [img.width, img.height];
    c.width = img.width;
    c.height = img.height;
    ctx.drawImage(img,0,0);
    var d = ctx.getImageData(0, 0, width, height);
    for (var i=0; i<d.data.length; i+=4) { // 4 is for RGBA channels
        // R=G=B=R>T?255:0
        d.data[i] = d.data[i+1] = d.data[i+2] = d.data[i+1] > threshold ? 255 : 0;
    }
    ctx.putImageData(d,0,0);
    return {
      original: originalImg,
      modified: {dataUrl: c.toDataURL(), width, height}
    };
  });