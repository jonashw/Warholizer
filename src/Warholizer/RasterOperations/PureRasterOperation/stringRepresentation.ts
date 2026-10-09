import { formatSize, valueOf } from "./length";
import { PureRasterOperation } from "./types";

export const stringRepresentation = (op: PureRasterOperation): string => {
  const opType = op.type;
  switch(opType){
    case 'halftone'  : return op.style === 'classic'
      ? `halftone(classic, ${formatSize(op.dotDiameter)}, ${op.angle}deg, ${formatSize(op.blurPixels)}${!op.invert ? '' : ', invert'}${!op.dotsOnly ? '' : ', dotsOnly'})`
      : `halftone(${op.shape ?? 'round'}, ${formatSize(op.dotDiameter)}, ${op.angle}deg${valueOf(op.blurPixels) ? `, blur ${formatSize(op.blurPixels)}` : ''}${(op.scale ?? 1) > 1 ? `, ×${op.scale}` : ''}${!op.invert ? '' : ', invert'})`;
    case 'stack'     : return `stack(${op.blendingMode})`;
    case 'noop'      : return "noop";
    case 'copies'    : return `copies(${op.n})`;
    case 'threshold' : return `threshold(${op.value})`;
    case 'rgbChannels': return `rgbChannels()`;
    case 'grayscale' : return `grayscale(${op.percent}%)`;
    case 'rotateHue' : return `rotateHue(${op.degrees}deg)`;
    case 'rotate'    : return `rotate(${op.degrees}deg, about ${op.about})`;
    case 'blur'      : return `blur(${formatSize(op.pixels)})`;
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
    case 'quantize'  : return `quantize(${op.colors}${op.replacements.some(r => r) ? `, ${op.replacements.map(r => r ?? '_').join(' ')}` : ''})`;
    case 'separateColors': return `separateColors(${op.colors}${op.replacements.some(r => r) ? `, ${op.replacements.map(r => r ?? '_').join(' ')}` : ''})`;
    case 'tone'      : return op.method.type === 'manual' ? `tone(manual, ${op.method.black}, ${op.method.white}, γ${op.method.gamma})`
      : op.method.type === 'auto' ? `tone(auto, clip ${op.method.clip}%)`
      : `tone(match ${typeof op.method.reference === 'object' ? `photo ${op.method.reference.photo}` : op.method.reference})`;
    case 'levels'    : return `levels(${op.black}, ${op.white}, γ${op.gamma})`;
    case 'gradientMap': return `gradientMap(${op.stops.join(' ')})`;
    case 'posterize' : return `posterize(${op.levels})`;
    case 'orderedDither': return `orderedDither(${op.matrixSize}×${op.matrixSize}, ${op.levels}${op.monochrome ? ', mono' : ''}${valueOf(op.pixelSize) > 1 || typeof op.pixelSize !== 'number' ? `, ${formatSize(op.pixelSize)}` : ''})`;
    case 'errorDiffusion': return `errorDiffusion(${op.method}, ${op.levels}${op.monochrome ? ', mono' : ''})`;
    case 'edges'     : return `edges(×${op.strength}${op.threshold > 0 ? `, ≥${op.threshold}` : ''}${op.invert ? ', invert' : ''})`;
    case 'stickerBorder': return `stickerBorder(${formatSize(op.width)}, ${op.color}${op.cutLine ? ', cut line' : ''})`;
    case 'colorKey'  : return `colorKey(${op.color ?? 'edge color'}, ±${op.tolerance}${op.softness > 0 ? `~${op.softness}` : ''}${op.connected ? ', connected' : ''})`;
    case 'cmykChannels': return `cmykChannels()`;
    case 'colorHalftone': return `colorHalftone(${op.shape ?? 'round'}, ${formatSize(op.dotDiameter)}${valueOf(op.blurPixels) ? `, blur ${formatSize(op.blurPixels)}` : ''}${(op.scale ?? 1) > 1 ? `, ×${op.scale}` : ''})`;
    default: {
      throw new Error(`Unexpected operation type: ${opType}`);
    }
  }
}