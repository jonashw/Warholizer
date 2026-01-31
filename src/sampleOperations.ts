import { Blur, Crop, Fill, Grayscale, Grid, Halftone, Invert, Line, Multiply, Noop, PrintSet, PureRasterOperation, Rotate, RotateHue, Scale, ScaleToFit, SlideWrap, Split, Stack, Threshold, Tile, Void } from './Warholizer/RasterOperations/PureRasterOperation';
import { angle, byte, positiveNumber } from './Warholizer/RasterOperations/NumberTypes';

export const sampleOperations: PureRasterOperation[] = ([
    { "type": "noop"} as Noop,
    { "type": "fill", color:"#3333ff"} as Fill,
    { "type": "split", dimension:"x",amount:50} as Split,
    { "type": "void"} as Void,
    { "type": "stack", blendingMode: "multiply" } as Stack,
    { "type": "scale", x: 0.5, y: 0.5 } as Scale,
    { "type": "crop", width: 50, height: 50, x: 0, y: 0, unit: '%' } as Crop,
    { "type": "scaleToFit", w: positiveNumber(500), h: positiveNumber(500) } as ScaleToFit,
    { "type": "tile", primaryDimension: 'x', lineLength: 2 } as Tile,
    { "type": "halftone", blurPixels:2, dotDiameter:10} as Halftone,
    { "type": "line", direction: 'right', squish: false} as Line,
    { "type": "grid", rows: 2, cols: 2 } as Grid,
    { "type": "threshold", value: byte(128) } as Threshold,
    { "type": "invert" } as Invert,
    { "type": "rotateHue", degrees: angle(180) } as RotateHue,
    { "type": "rotate", degrees: 90, about:'center' } as Rotate,
    { "type": "multiply", n: 2 } as Multiply,
    { "type": "slideWrap", amount: 50, dimension: 'x' } as SlideWrap,
    { "type": "grayscale", percent: 100 } as Grayscale,
    { "type": "blur", pixels: 5 } as Blur,
    { "type": "printSet", paperSize: 'letter', orientation:'portrait', tilingPattern: 'half-drop'} as PrintSet,
] as PureRasterOperation[])
.sort((a,b) => a.type < b.type ? -1 : b.type < a.type ? 1 : 0);