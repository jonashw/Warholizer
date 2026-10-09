import { Byte } from "../../../NumberTypes";
import { Noise } from "./types";

/**
 * The per-pixel steps of operations. Everything else in `apply` is composition that the browser
 * already accelerates; these are the loops worth porting (GPU, WASM). Kernels never mutate inputs.
 */
export type PixelKernels = {
  name: string,
  /** Black or white per pixel by luminance (alpha-weighted); output is opaque. */
  threshold: (input: OffscreenCanvas, value: Byte) => Promise<OffscreenCanvas>,
  /** Random noise composited over the input at `op.amount` percent opacity. */
  noise: (input: OffscreenCanvas, op: Noise) => Promise<OffscreenCanvas>,
  /** One image per channel (red, green, blue), each on white, keeping the input's alpha. */
  rgbChannels: (input: OffscreenCanvas) => Promise<OffscreenCanvas[]>,
};

const canvasFrom = (data: ImageData): OffscreenCanvas => {
  const c = new OffscreenCanvas(data.width, data.height);
  c.getContext('2d')!.putImageData(data, 0, 0);
  return c;
};

const readPixels = (input: OffscreenCanvas): ImageData =>
  input.getContext('2d')!.getImageData(0, 0, input.width, input.height);

function rgbaValue(r: number, g: number, b: number, a: number) {
  //reference: https://computergraphics.stackexchange.com/a/5114
  //const [rPeakWavelength,gPeakWavelength,bPeakWavelength]=[600,540,450];
  const [rCoeff,gCoeff,bCoeff]=[0.21,0.72,0.07];
  return Math.floor((a/255) * ((r * rCoeff) + (g * gCoeff) + (b * bCoeff)));
}

const isEmpty = (c: OffscreenCanvas) => c.width === 0 || c.height === 0;

/** Reference kernels: JavaScript loops over ImageData. Zero-area inputs yield zero-area outputs. */
export const cpuKernels: PixelKernels = {
  name: 'cpu',

  threshold: async (input, value) => {
    if (isEmpty(input)) {
      return new OffscreenCanvas(input.width, input.height);
    }
    const imgData = readPixels(input);
    for (let i=0; i<imgData.data.length; i+=4) { // 4 is for RGBA channels
      const currentPixelValue = rgbaValue(
        imgData.data[i+0],
        imgData.data[i+1],
        imgData.data[i+2],
        imgData.data[i+3]);
      const thresholdValue = currentPixelValue < value ? 0 : 255;
      imgData.data[i+0] = thresholdValue;//R
      imgData.data[i+1] = thresholdValue;//G
      imgData.data[i+2] = thresholdValue;//B
      imgData.data[i+3] = 255;//A
    }
    return canvasFrom(imgData);
  },

  noise: async (input, op) => {
    if (isEmpty(input)) {
      return new OffscreenCanvas(input.width, input.height);
    }
    const outputData = new ImageData(input.width, input.height);
    const randomByte = () => Math.floor(Math.random() * 255);
    for (let i = 0; i < outputData.data.length; i += 4) { // 4 is for RGBA channels
      if(op.monochromatic){
        const rand = randomByte();
        outputData.data[i + 0] = rand;
        outputData.data[i + 1] = rand;
        outputData.data[i + 2] = rand;
      } else {
        outputData.data[i + 0] = randomByte();
        outputData.data[i + 1] = randomByte();
        outputData.data[i + 2] = randomByte();
      }
      outputData.data[i + 3] = 255;
    }
    const noiseImg = canvasFrom(outputData);
    const c = new OffscreenCanvas(input.width, input.height);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(input,0,0);
    ctx.globalAlpha = op.amount / 100;
    ctx.drawImage(noiseImg,0,0);
    return c;
  },

  rgbChannels: async (input) => {
    if (isEmpty(input)) {
      return [0, 1, 2].map(() => new OffscreenCanvas(input.width, input.height));
    }
    const inputData = readPixels(input);
    const empty = 255;
    const channels = [0, 1, 2].map(() => new ImageData(input.width, input.height));
    for (let i = 0; i < inputData.data.length; i += 4) { // 4 is for RGBA channels
      const a = inputData.data[i+3];
      channels.forEach((out, channel) => {
        for (let j = 0; j < 3; j++) {
          out.data[i+j] = j === channel ? inputData.data[i+j] : empty;
        }
        out.data[i+3] = a;
      });
    }
    return channels.map(canvasFrom);
  },
};
