import { Crop } from "react-image-crop";
import VR, { ValueRange } from "./ValueRange";
import { TilingPattern } from "./TilingPattern";
import RasterOperations from "./RasterOperations";

export type Cropping = {crop: Crop, adjustRatio: {x: number, y: number}};
export type ImagePayload = {dataUrl: string; width:number; height: number,imageData: ImageData};

export class WarholizerImage {
  public payload: ImagePayload;
  //private imgElement?: HTMLImageElement;//for optimization?
  constructor(payload: ImagePayload){
    this.payload = payload;
  }
  async addGrain(noiseType: NoiseType){
    return new WarholizerImage(await addGrain(this.payload, noiseType));
  }
  async threshold(value: number){
    const vrs = VR.split(VR.initial(), [value] );
    return new WarholizerImage((await applyImageValueRanges(vrs,this.payload)).modified);
  }
}

/*
const getTextHeight = (font: string, _: string) => {
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
*/

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
  new Promise((resolve,_) => {
    let c = document.createElement('canvas');
    document.body.prepend(c);
    let ctx = c.getContext('2d')!;
    let cssFont = `${sizeInPx}px ${font}`;
    ctx.font = cssFont;

    let measurements = ctx.measureText(text);
    //let textHeight = getTextHeight(cssFont,text).height;
    let textHeight2 = determineFontHeight(`font-family:${font}; font-size: ${sizeInPx}px;`);
    //console.log(measurements.width, textHeight2, textHeight)
    //let marginPct = 1/16;
    c.width = measurements.width;
    c.height= textHeight2;
    //let margin = Math.max();
    //measurements.fontBoundingBoxAscent + measurements.fontBoundingBoxDescent;
    //console.log(c.height, );
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
      width: measurements.width,
      imageData: ctx.getImageData(0,0,c.width,c.height)
    });
    c.remove();
  });

const offscreenCanvasOperation = async (
  width: number,
  height: number,
  action: (ctx: OffscreenCanvasRenderingContext2D) => void
): Promise<OffscreenCanvas> => {
  const c = new OffscreenCanvas(width,height);
  let ctx = c.getContext('2d')!;
  action(ctx);
  return c;
};

const with2dContext = (
  width: number,
  height: number,
  action: (ctx: CanvasRenderingContext2D, c: HTMLCanvasElement) => void
): ImagePayload => {
  let c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  document.body.append(c);
  let ctx = c.getContext('2d')!;
  action(ctx,c);
  c.remove();
  const w = c.width;
  const h = c.height;
  return {
    dataUrl: c.toDataURL(), 
    width: w, 
    height: h,
    imageData: ctx.getImageData(0,0,w,h)
  };
};

/*
const with2dContextOffscreen = async (
  width: number,
  height: number,
  action: (ctx: OffscreenCanvasRenderingContext2D) => void
): Promise<ImagePayload> => {
  let c = new OffscreenCanvas(width,height);
  let ctx = c.getContext('2d')!;
  action(ctx);
  const blob = await c.convertToBlob();
  const dataUrl = await blobToDataURL(blob);
  return { width, height, dataUrl };
};

*/

function editImage<T>(
  src: string,
  fn: (
    img: HTMLImageElement,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D
) => T): Promise<T> 
{
  return new Promise((resolve,_) => {
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

const loadImgElement = (src:string): Promise<HTMLImageElement> => 
  new Promise((resolve,_) => {
    let img = new Image();
    img.onload = () => {
      resolve(img);
    };
    img.src = src;
  });

export const load = (src: string): Promise<ImagePayload> =>
  editImage(src,(img,c,ctx) => {
    c.width = img.width;
    c.height = img.height;
    ctx.drawImage(img,0,0);
    return {
      dataUrl: c.toDataURL(),
      width: c.width,
      height: c.height,
      imageData: ctx.getImageData(0,0,c.width,c.height)
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
      height: c.height,
      imageData: ctx.getImageData(0,0,c.width,c.height)
    };
  });

export const applyImageValueRanges = (
  ranges: ValueRange[],
  original: ImagePayload
): Promise<{
  modified:ImagePayload,
  original:ImagePayload,
  stencilMasks: ImagePayload[]
}> => 
  editImage(original.dataUrl, (img, c, ctx) => {
    let [width,height] = [img.width, img.height];
    c.width = img.width;
    c.height = img.height;
    ctx.drawImage(img,0,0);
    let originalImage = ctx.getImageData(0, 0, width, height);
    const clampValueIfInRange = (value: number , range: ValueRange): [boolean,number] => 
        range.min <= value && value <= range.max
        ? [true,range.value]
        : [false,value];

    let rangeImages = ranges.map(range => {
      //each ValueRange yields its own bitmap that could be transformed into a stencil.
      let rangeImage = new ImageData(
        originalImage.width,
        originalImage.height,
        {
          colorSpace: originalImage.colorSpace 
        });
      for (var i=0; i<originalImage.data.length; i+=4) { // 4 is for RGBA channels
        var v = rgbaValue( originalImage.data[i],  originalImage.data[i+1],  originalImage.data[i+2],  originalImage.data[i+3] );
        let [inRange,value] = clampValueIfInRange( v, range);
        if(inRange){
          rangeImage.data[i+0] = 0
          rangeImage.data[i+1] = 0
          rangeImage.data[i+2] = 0
          rangeImage.data[i+3] = 255;
          originalImage.data[i+0] = value;//R
          originalImage.data[i+1] = value;//G
          originalImage.data[i+2] = value;//B
          originalImage.data[i+3] = inRange ? 255 : 0;//A
        }
      }
      return rangeImage;
    });

    let rangeImagePayloads: ImagePayload[] =
      rangeImages.map(rangeImage => {
        ctx.clearRect(0, 0, width, height);
        ctx.putImageData(rangeImage, 0, 0);
        return {
          dataUrl: c.toDataURL(),
          width,
          height,
          imageData: ctx.getImageData(0,0,width,height)
        };
      });

    ctx.clearRect(0, 0, width, height);
    ctx.putImageData(originalImage, 0, 0);

    //console.log({ranges, rangeImages, rangeImagePayloads});

    return {
      original,
      modified: {
        dataUrl: c.toDataURL(),
        width,
        height,
        imageData: ctx.getImageData(0,0,width,height)
      },
      stencilMasks: rangeImagePayloads
    };
  });

export const MAX_QUANITIZATION_DEPTH = 5;
export type Quantization = {
  quantized:ImagePayload,
  reassembled:ImagePayload,
  original:ImagePayload,
  originalColorCount: number,
  colorBuckets: ColorBucket[]
};

type ColorBucket = {
  original: ImagePayload,
  masked: ImagePayload,
  highlightedMask: ImagePayload,
  originalImgData: ImageData,
  maskedImgData: ImageData,
  averageColorCSS: string
}

export const quantize = (
  original: ImagePayload,
  depth: number,
  replacementColors: ([number,number,number]|undefined)[]
): Promise<Quantization> => 
  editImage(original.dataUrl, (img, c, ctx) => {
    let [width,height] = [img.width, img.height];
    c.width = img.width;
    c.height = img.height;

    const imageDataToPayload = (d: ImageData): ImagePayload => {
      ctx.clearRect(0, 0, width, height);
      ctx.putImageData(d, 0, 0);
      return {
        dataUrl: c.toDataURL(),
        width,
        height,
        imageData: ctx.getImageData(0,0,width,height)
      };
    };

    ctx.drawImage(img,0,0);
    let originalImage = ctx.getImageData(0, 0, width, height);

    let colorBuckets: ColorBucket[] = 
      quantizeLoop(originalImage,depth).map((bucketImgData,i) => {
        let replacementColor = replacementColors[i] ;
        let maskColor = 
          !!replacementColor
          ? replacementColor 
          : averageColor(bucketImgData);
        let maskedImgData = colorMask(maskColor,bucketImgData);
        let masked = imageDataToPayload(maskedImgData);
        let cssColor = `rgba(${maskColor.join(',')})`;
        //console.log({maskColor: cssColor});

        type RGBColor = [number,number,number];
        const highlightColor: RGBColor = [255,0,255];
        let highlightedMask = imageDataToPayload(colorMask(highlightColor,bucketImgData));

        return {
          original: imageDataToPayload(bucketImgData),
          originalImgData: bucketImgData,
          masked,
          highlightedMask,
          maskedImgData,
          averageColorCSS: cssColor
        }
      });

    return {
      original,
      originalColorCount: colorPaletteSize(originalImage),
      quantized: 
        imageDataToPayload(
          mergeImages(colorBuckets.map(cb => cb.maskedImgData))),
      reassembled: 
        imageDataToPayload(
          mergeImages(colorBuckets.map(cb => cb.originalImgData))),
      colorBuckets
    };
  });

  const colorPaletteSize = (img: ImageData): number => {
    let colors = new Set<number>();
    for (var i = 0; i < img.data.length; i += 4) { // 4 is for RGBA channels
      if(img.data[i+3] === 255){
        let rgba = rgbaEncode(
          img.data[i+0],
          img.data[i+1],
          img.data[i+2],
          img.data[i+3]
        );
        colors.add(rgba);
      }
    }
    return colors.size;
  };
  

const mergeImages = (imgs: ImageData[]): ImageData => {
  let merged = new ImageData(
    imgs[0].width,
    imgs[0].height,
    {
      colorSpace: imgs[0].colorSpace 
    });

  for(let img of imgs){
    for (var i = 0; i < merged.data.length; i += 4) { // 4 is for RGBA channels
      if(img.data[i+3] === 255){
        merged.data[i+0] = img.data[i+0];
        merged.data[i+1] = img.data[i+1]; 
        merged.data[i+2] = img.data[i+2];
        merged.data[i+3] = img.data[i+3];
      }
    }
  }

  return merged;
};

const colorMask = (color: [number,number,number], mask: ImageData): ImageData => {
  const outImg = new ImageData(
    mask.width,
    mask.height,
    {
      colorSpace: mask.colorSpace 
    });
  for (var i = 0; i < mask.data.length; i += 4) { // 4 is for RGBA channels
    if(mask.data[i+3] > 0){
      outImg.data[i+0] = color[0];
      outImg.data[i+1] = color[1];
      outImg.data[i+2] = color[2];
      outImg.data[i+3] = 255;
    }
  }

  return outImg;
};

const quantizeLoop = (img: ImageData, i: number): ImageData[] => {
  if(i===0){
    return [img];
  }
  let {upper,lower,pixelCount} = divide(img);
  //console.log(`loop #${i}:`, stats.printable);
  return [
    ...(pixelCount.upper > 0 ? [upper] : []),
    ...(pixelCount.lower > 0 ? [lower] : [])
  ].flatMap(subImg => quantizeLoop(subImg, i-1));
};

const averageColor = (img: ImageData): [number,number,number] => {
  const sums: [number, number, number] = [0,0,0];
  let opaqueCount = 0;
  for (var i = 0; i < img.data.length; i += 4) { // 4 is for RGBA channels
    if(img.data[i+3] === 255){
      sums[0] += img.data[i + 0];
      sums[1] += img.data[i + 1];
      sums[2] += img.data[i + 2];
      opaqueCount++;
    }
  }
  if(opaqueCount === 0){
    return [0,0,0];
  }
  return [
    Math.floor(sums[0]/opaqueCount),
    Math.floor(sums[1]/opaqueCount),
    Math.floor(sums[2]/opaqueCount)
  ];
};

const divide = (img: ImageData) => {
  let valuesByDimension = Array(3).fill(0).map((_, dindex) => {
    var values = new Set<number>();
    for (var i = 0; i < img.data.length; i += 4) { // 4 is for RGBA channels
      if(img.data[i+3] === 255){//Alpha
        values.add(img.data[i + dindex]);
      }
    }
    let valuesArray = Array.from(values).sort((a,b) => a>b?a:b);
    //console.log({values,valuesArray});
    return valuesArray;
  });
  let dimensions =
    valuesByDimension.map((vs,index) => {
      let min = vs[0];
      let max = vs[vs.length-1];
      let range = max-min;
      return {min, max, range, index, vs};
    });
  //console.log({dimensions});
  let dominantDimension = dimensions.reduce((a,b) => a.range > b.range ? a : b);
  let values = valuesByDimension[dominantDimension.index];
  let medianValue = values[Math.ceil(values.length/2)];
  let division = {
    upper: new ImageData(
      img.width,
      img.height,
      {
        colorSpace: img.colorSpace 
      }),
    lower: new ImageData(
      img.width,
      img.height,
      {
        colorSpace: img.colorSpace 
      })
  };
  const pixelCount = {upper: 0, lower: 0};
  for (var i = 0; i < img.data.length; i += 4) { // 4 is for RGBA channels
    division.lower.data[i + 3] = 0;
    division.upper.data[i + 3] = 0;
    let v = img.data[i + dominantDimension.index];
    let isLower = v < medianValue;
    let newBucket = isLower ? division.lower : division.upper;
    if(isLower){
      pixelCount.lower++;
    } else {
      pixelCount.upper++;
    }
    newBucket.data[i + 0] = img.data[i+0];
    newBucket.data[i + 1] = img.data[i+1];
    newBucket.data[i + 2] = img.data[i+2];
    newBucket.data[i + 3] = img.data[i+3];
  }
  return {
    pixelCount,
    stats: {
      dimensions,
      dominantDimension,
      medianValue
    },
    ...division
  };
  /* source: https://spin.atomicobject.com/2016/12/07/pixels-and-palettes-extracting-color-palettes-from-images/
  1. Compute the range of pixel values for each dimension (red, green, and blue).
  2. Select the dimension with the largest range.
  3. Compute the median pixel value for that dimension.
  4. Split the pixels into two groups, one below the median pixel value and one above.
  5. Repeat the process recursively.  */

  /* source: https://en.wikipedia.org/wiki/Median_cut
  Suppose we have an image with an arbitrary number of pixels and want to generate a palette of 16 colors.
  1. Put all the pixels of the image (that is, their RGB values) in a bucket.
  2. Find out which color channel (red, green, or blue) among the pixels in the bucket has the greatest range,
  3. then sort the pixels according to that channel's values.
      (For example, if the blue channel has the greatest range,
      then a pixel with an RGB value of (32, 8, 16) is less than a pixel with an RGB value of (1, 2, 24),
      because 16 < 24.)
  4. After the bucket has been sorted, move the upper half of the pixels into a new bucket.
      (It is this step that gives the median cut algorithm its name;
      the buckets are divided into two at the median of the list of pixels.)
  5. This process can be repeated to further subdivide the set of pixels: choose a bucket to divide
      (e.g., the bucket with the greatest range in any color channel) and divide it into two.
  6. After the desired number of buckets have been produced, average the pixels in each bucket to get the
      final color palette.  */
};

function rgbaEncode(red: number, green: number, blue: number, alpha: number): number {
    var r = red & 0xFF;
    var g = green & 0xFF;
    var b = blue & 0xFF;
    var a = alpha & 0xFF;
    
    return (r << 24) + (g << 16) + (b << 8) + (a);
}


function rgbaValue(r: number, g: number, b: number, a: number) {
  //reference: https://computergraphics.stackexchange.com/a/5114
  //const [rPeakWavelength,gPeakWavelength,bPeakWavelength]=[600,540,450];
  const [rCoeff,gCoeff,bCoeff]=[0.21,0.72,0.07];
  return Math.floor((a/255) * ((r * rCoeff) + (g * gCoeff) + (b * bCoeff)));
}

/*
function rgbaDecode(rgba:number): [number, number, number, number] {
  return [
    (rgba >> 24) & 0xFF,
    (rgba >> 16) & 0xFF,
    (rgba >>  8) & 0xFF,
    (rgba >>  0) & 0xFF
  ];
}
*/

export const getValueHistogram = (
  original: ImagePayload
): Promise<ImagePayload> => 
  editImage(original.dataUrl, (img, c, ctx) => {
    let [width,height] = [img.width, img.height];
    c.width = img.width;
    c.height = img.height;
    ctx.drawImage(img,0,0);
    let originalImage = ctx.getImageData(0, 0, width, height);
    var pixelCountByValue = Array(255).fill(0);
    for (var i=0; i<originalImage.data.length; i+=4) { // 4 is for RGBA channels
      var v = rgbaValue( originalImage.data[i],  originalImage.data[i+1],  originalImage.data[i+2],  originalImage.data[i+3] );
      pixelCountByValue[v]++;
    }
    var totalPixelCount = originalImage.data.length/4;
    var max = pixelCountByValue.reduce((a,b) => Math.max(a,b));
    var proportionalPixelsByValue = pixelCountByValue.map(c => Math.floor(100*c/max));
    //var checksum = proportionalPixelsByValue.reduce((a,b) => a+b);
    //console.log({proportionalPixelsByValue,checksum});

    ctx.clearRect(0, 0, width, height);
    c.width = 255;
    c.height = 100;
    ctx.fillStyle="black";
    for(let i=0; i<totalPixelCount; i++){
      var h = proportionalPixelsByValue[i];
      ctx.fillRect(i,c.height-h,1,h);
    }

    return {
      dataUrl: c.toDataURL(),
      width,
      height,
      imageData: ctx.getImageData(0,0,width,height)
    };
  });


type NoiseType = "bw" | "rgb" | "grayscale";
const noise = (width: number, height: number, type: NoiseType): Promise<ImagePayload> => 
  Promise.resolve(with2dContext(width,height,(ctx) => {
    const data = ctx.getImageData(0,0,width,height);
    switch(type){
      case "bw":
        for(let i=0; i<data.data.length; i+=4){
          var n = 255 * Math.round(Math.random());
          data.data[i+0] = n;
          data.data[i+1] = n;
          data.data[i+2] = n;
          data.data[i+3] = 255;
        }
        break;
      case "rgb":
        for(let i=0; i<data.data.length; i+=4){
          data.data[i+0] = 255 * Math.round(Math.random());
          data.data[i+1] = 255 * Math.round(Math.random());
          data.data[i+2] = 255 * Math.round(Math.random());
          data.data[i+3] = 255;
        }
        break;
      case 'grayscale':
        for(let i=0; i<data.data.length; i+=4){
          var n = Math.floor(255 * Math.random());
          data.data[i+0] = n;
          data.data[i+1] = n;
          data.data[i+2] = n;
          data.data[i+3] = 255;
        }
        break;
    }
    ctx.putImageData(data,0,0);
  }));

const addGrain = async (img: ImagePayload, noiseType: NoiseType): Promise<ImagePayload> => {
  const [width,height] = [img.width, img.height];
  const noisePayload = await noise(width, height, noiseType);
  const inputImg = await loadImgElement(img.dataUrl);
  const noiseImg = await loadImgElement(noisePayload.dataUrl);
  return with2dContext(img.width, img.height,(ctx) => {
    ctx.drawImage(inputImg,0,0);
    //ctx.globalCompositeOperation ="darken";
    ctx.globalAlpha = 0.15;
    ctx.drawImage(noiseImg,0,0);
  });
}

const invert = async (img: ImagePayload): Promise<ImagePayload> => {
  const inputImg = await loadImgElement(img.dataUrl);
  return with2dContext(img.width, img.height,(ctx) => {
    ctx.filter="invert()";
    ctx.drawImage(inputImg,0,0);
  });
}

const threshold = async (img: ImagePayload, value: number): Promise<ImagePayload> => {
  const vrs = VR.split(VR.initial(), [value] );
  return (await applyImageValueRanges(vrs,img)).modified;
};


const offscreenCanvasToPayload = async (result: OffscreenCanvas): Promise<ImagePayload> => {
  const dataUrl = URL.createObjectURL(await result.convertToBlob());
  const element = await loadImgElement(dataUrl);
  const data = result.getContext('2d')!.getImageData(0,0,element.width,element.height);
  return {
      imageData: data,
      dataUrl:   element.src,
      height:    element.height,
      width:     element.width
  };
};

const tilingPattern = async (input: ImagePayload, tp: TilingPattern): Promise<ImagePayload> => {
  const img = await loadImgElement(input.dataUrl);
  const operationInput = await offscreenCanvasOperation(img.width,img.height,(ctx) => {
    ctx.drawImage(img,0,0);
  });
  const output = await RasterOperations.apply(tp.rasterOperation, operationInput);
  return await offscreenCanvasToPayload(output);
};

export default {
  tilingPattern,
  noise,
  invert,
  addGrain,
  text,
  load,
  crop,
  threshold,
  applyImageValueRanges,
  MAX_QUANITIZATION_DEPTH,
  quantize,
  getValueHistogram
};

/*
async function canvasToImagePayload(
  c: HTMLCanvasElement | OffscreenCanvas,
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
): Promise<ImagePayload> {
  const dataUrl = 
    await (c instanceof HTMLCanvasElement
    ? Promise.resolve(c.toDataURL())
    : c.convertToBlob().then(blobToDataURL));
  return {
    dataUrl,
    width: c.width,
    height: c.height,
    imageData: ctx.getImageData(0,0,c.width,c.height)
  };
}

const blobToDataURL = (blob: Blob): Promise<string> =>
  new Promise(resolve => {
    var a = new FileReader();
    a.onload = e => resolve(e.target?.result as string);
    a.readAsDataURL(blob);
  });
*/