import { Crop } from "react-image-crop";
import { ValueRange } from "./ValueRange";

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

export const applyImageValueRanges = (
  ranges: ValueRange[],
  originalImg: ImagePayload
): Promise<{
  modified:ImagePayload,
  original:ImagePayload,
  stencilMasks: ImagePayload[]
}> => 
  editImage(originalImg.dataUrl, (img, c, ctx) => {
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
        let [inRange,value] = clampValueIfInRange(originalImage.data[i], range);
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
          height
        };
      });

    ctx.clearRect(0, 0, width, height);
    ctx.putImageData(originalImage, 0, 0);

    console.log({ranges, rangeImages, rangeImagePayloads});

    return {
      original: originalImg,
      modified: {dataUrl: c.toDataURL(), width, height},
      stencilMasks: rangeImagePayloads
    };
  });

export const MAX_QUANITIZATION_DEPTH = 5;
export type Quantization = {
  modified:ImagePayload,
  reassembled:ImagePayload,
  original:ImagePayload,
  colorMasks: ImagePayload[],
  colorBucketImages: ImagePayload[]
};

export const quantize = (
  originalImg: ImagePayload,
  depth: number
): Promise<Quantization> => 
  editImage(originalImg.dataUrl, (img, c, ctx) => {
    let [width,height] = [img.width, img.height];
    c.width = img.width;
    c.height = img.height;
    ctx.drawImage(img,0,0);
    let originalImage = ctx.getImageData(0, 0, width, height);

    let colorBuckets = 
      quantizeLoop(originalImage,depth).map(img => {
        let avgColor = averageColor(img);
        let maskedImg = colorMask(avgColor,img);
        return {
          img,
          maskedImg,
          avgColor
        };
      });

    let colorBucketImages = 
      colorBuckets.map(b => {
        ctx.clearRect(0, 0, width, height);
        ctx.putImageData(b.img, 0, 0);
        return {
          dataUrl: c.toDataURL(),
          width,
          height
        };
      });

    let colorMasks = 
      colorBuckets.map(b => {
        ctx.clearRect(0, 0, width, height);
        ctx.putImageData(b.maskedImg, 0, 0);
        return {
          dataUrl: c.toDataURL(),
          width,
          height
        };
      });

    let modifiedImage = mergeImages(colorBuckets.map(cb => cb.maskedImg));
    ctx.clearRect(0, 0, width, height);
    ctx.putImageData(modifiedImage, 0, 0);
    let modified = {dataUrl: c.toDataURL(), width, height};

    let reassembledImage = mergeImages(colorBuckets.map(cb => cb.img));
    ctx.clearRect(0, 0, width, height);
    ctx.putImageData(reassembledImage, 0, 0);
    let reassembled = {dataUrl: c.toDataURL(), width, height};

    return {
      original: originalImg,
      modified,
      reassembled,
      colorMasks,
      colorBucketImages
    };
  });

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

const colorMask = (color: [number,number,number,number], mask: ImageData): ImageData => {
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
  let {upper,lower} = divide(img);
  //console.log(`loop #${i}:`, stats.printable);
  return [
    upper,
    lower,
  ].flatMap(subImg => quantizeLoop(subImg, i-1));
};

const averageColor = (img: ImageData): [number,number,number,number] => {
  const sums: [number, number, number, number] = [0,0,0,0];
  for (var i = 0; i < img.data.length; i += 4) { // 4 is for RGBA channels
    sums[0] += img.data[i + 0];
    sums[1] += img.data[i + 1];
    sums[2] += img.data[i + 2];
    sums[3] += img.data[i + 3];
  }
  let pixelCount = img.data.length / 4;
  return [
    Math.floor(sums[0]/pixelCount),
    Math.floor(sums[1]/pixelCount),
    Math.floor(sums[2]/pixelCount),
    Math.floor(sums[3]/pixelCount)
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
    console.log({values,valuesArray});
    return valuesArray;
  });
  let dimensions =
    valuesByDimension.map((vs,index) => {
      let min = vs[0];
      let max = vs[vs.length-1];
      let range = max-min;
      return {min, max, range, index, vs};
    });
  console.log({dimensions});
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
  for (var i = 0; i < img.data.length; i += 4) { // 4 is for RGBA channels
    division.lower.data[i + 3] = 0;
    division.upper.data[i + 3] = 0;
    let v = img.data[i + dominantDimension.index];
    let newBucket = v < medianValue ? division.lower : division.upper;
    newBucket.data[i + 0] = img.data[i+0];
    newBucket.data[i + 1] = img.data[i+1];
    newBucket.data[i + 2] = img.data[i+2];
    newBucket.data[i + 3] = 255;//why bother with any other alpha?
  }
  return {
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
