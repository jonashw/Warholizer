export type ImagePayload = {dataUrl: string; width:number; height: number};
export const applyImageThreshold = (
  threshold: number,
  imgUrl: string
): Promise<{
  modified:ImagePayload,
  original:ImagePayload
}> => 
  new Promise(resolve => {
    let myImage = new Image();
    myImage.onload = () => {
        let c = document.createElement('canvas');
        let [w,h] = [myImage.width, myImage.height];
        c.width = w;
        c.height = h;
        document.body.prepend(c);
        let ctx = c.getContext('2d')!;
        ctx.drawImage(myImage,0,0);
        var d = ctx.getImageData(0, 0, w, h);
        for (var i=0; i<d.data.length; i+=4) { // 4 is for RGBA channels
            // R=G=B=R>T?255:0
            d.data[i] = d.data[i+1] = d.data[i+2] = d.data[i+1] > threshold ? 255 : 0;
        }
        ctx.putImageData(d,0,0);
        resolve({
          original: {dataUrl: imgUrl, width:w, height: h},
          modified: {dataUrl: c.toDataURL(), width:w, height: h}
        });
        c.remove();
    };
    myImage.src = imgUrl;
  });
