import { PureRasterOperation } from "./types";

export const stringRepresentation = (op: PureRasterOperation): string => {
  const opType = op.type;
  switch(opType){
    case 'halftone'  : return `halftone(${op.dotDiameter}px, ${op.angle}deg, ${op.blurPixels}px${!op.invert ? '' : ', invert'}${!op.dotsOnly ? '' : ', dotsOnly'})`;
    case 'stack'     : return `stack(${op.blendingMode})`;
    case 'noop'      : return "noop";
    case 'multiply'  : return `multiply(${op.n})`;
    case 'threshold' : return `threshold(${op.value})`;
    case 'rgbChannels': return `rgbChannels()`;
    case 'grayscale' : return `grayscale(${op.percent}%)`;
    case 'rotateHue' : return `rotateHue(${op.degrees}deg)`;
    case 'rotate'    : return `rotate(${op.degrees}deg, about ${op.about})`;
    case 'blur'      : return `blur(${op.pixels}px)`;
    case 'invert'    : return "invert";
    case 'crop'      : return `crop(${op.x},${op.y},${op.width},${op.height},${op.unit})`;
    case 'printSet'  : return `printSet(${op.paperSize},${op.orientation},${op.tilingPattern})`;
    case 'grid'      : return `grid(${op.rows},${op.cols})`;
    case 'split'     : return `split(${op.dimension},${op.amount}%)`;
    case 'slideWrap' : return `slideWrap(${op.dimension},${op.amount}%)`;
    case 'scaleToFit': return `scaleToFit(${op.w},${op.h})`;
    case 'scale'     : return `scale(${op.x},${op.y})`;
    case 'line'      : return `line(${op.direction},${op.squish})`;
    case 'tile'      : return `tile(${op.primaryDimension},${op.lineLength})`;
    case 'void'      : return `void`;
    case 'noise'     : return `noise(${op.amount}%,mono:${op.monochromatic})`;
    case 'fill'      : return `fill(${op.color})`;
    default: {
      throw new Error(`Unexpected operation type: ${opType}`);
    }
  }
}