import { PureRasterOperation } from './Warholizer/RasterOperations/PureRasterOperation';
import { angle, byte, positiveNumber } from './Warholizer/RasterOperations/NumberTypes';


export const sampleOperations: PureRasterOperation[] = ([
    { "type": "noop"},
    { "type": "fill", color:"green"},
    { "type": "split", dimension:"x",amount:50},
    { "type": "void"},
    { "type": "stack", blendingMode: "multiply" },
    { "type": "scale", x: 0.5, y: 0.5 },
    { "type": "crop", width: 50, height: 50, x: 0, y: 0, unit: '%' },
    { "type": "scaleToFit", w: positiveNumber(500), h: positiveNumber(500) },
    { "type": "tile", primaryDimension: 'x', lineLength: 2 },
    { "type": "line", direction: 'right' },
    { "type": "grid", rows: 2, cols: 2 },
    { "type": "threshold", value: byte(128) },
    { "type": "invert" },
    { "type": "rotateHue", degrees: angle(180) },
    { "type": "rotate", degrees: 90 },
    { "type": "multiply", n: 2 },
    { "type": "slideWrap", amount: 50, dimension: 'x' },
    { "type": "grayscale", percent: 100 },
    { "type": "blur", pixels: 5 }
] as PureRasterOperation[])
.sort((a,b) => a.type < b.type ? -1 : b.type < a.type ? 1 : 0);
