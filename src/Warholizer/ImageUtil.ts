import { Crop } from "react-image-crop";

export type Cropping = {crop: Crop, adjustRatio: {x: number, y: number}};
export type ImagePayload = {dataUrl: string; width:number; height: number};

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
  imgUrl: string
): Promise<{
  modified:ImagePayload,
  original:ImagePayload
}> => 
  editImage(imgUrl, (img, c, ctx) => {
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
      original: {dataUrl: imgUrl, width, height},
      modified: {dataUrl: c.toDataURL(), width, height}
    };
  });