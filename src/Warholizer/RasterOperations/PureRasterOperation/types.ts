import { CSSProperties } from "react";
import { Angle, Byte, Percentage, PositiveNumber} from "../../../NumberTypes";

export type PureRasterOperation = 
  | Stack
  | Split
  | Void
  | Crop
  | Grid
  | Fill
  | Halftone 
  | Tile
  | Line
  | PrintSet
  | SlideWrap 
  | Scale
  | Noise
  | ScaleToFit
  | Noop
  | Blur
  | RotateHue
  | Rotate
  | Grayscale
  | Threshold
  | RGBChannels
  | Multiply
  | Invert;

export type Dimension = 'x'|'y';
export type Direction = 'up' | 'down' | 'left' | 'right';
export type Invert = { type: "invert" };
export type Void = { type: "void" };
export type Fill = { type: "fill", color: CSSProperties["color"], blendingMode: BlendingMode};
export type Noop = { type: "noop" };
export type Crop = { type: "crop", x: number, y: number, width: number, height: number, unit: 'px' | '%' }
export type Threshold = { type: "threshold", value: Byte };
export type Multiply = { type: "multiply", n: number };
export type Split = { type: "split", dimension: Dimension, amount: Percentage };
export type SlideWrap = { type: "slideWrap", dimension: Dimension, amount: Percentage };
export type Halftone = { type: "halftone", angle: Angle, dotDiameter: number, blurPixels: number, dotsOnly?: boolean, invert?: boolean };
export type Blur = { type: "blur", pixels: number };
export type Grayscale = { type: "grayscale", percent: Percentage };
export type RotationOrigin = "center"|"top-right"|"top-left"|"bottom-left"|"bottom-right";
export const RotationOrigins: RotationOrigin[] = ["center","top-right","top-left","bottom-left","bottom-right"];
export type Rotate = { type: "rotate", degrees: Angle, about: RotationOrigin };
export type RotateHue = { type: "rotateHue", degrees: Angle };
export type Scale = { type: "scale", x: number, y: number };
export type ScaleToFit = { type: "scaleToFit", w: PositiveNumber, h: PositiveNumber };
export type Line = { type: "line", direction: Direction, squish:boolean};
export type Tile = { type: "tile", primaryDimension: Dimension, lineLength: number };
export type Grid = { type: "grid", rows: number, cols: number };
export type Stack = {type: "stack", blendingMode: BlendingMode};
export type Noise = { type: "noise", monochromatic: boolean, amount: Percentage };
export type PrintSet = {
  type: "printSet",
  paperSize: PaperSizeId,
  tilingPattern: TilingPattern,
  orientation: 'portrait' | 'landscape',
  rowLength: PositiveNumber
};
export type RGBChannels = { type: "rgbChannels" };

export type BlendingMode = 
  | "source-over" | "source-in" | "source-out" | "source-atop"
  | "destination-over" | "destination-in" | "destination-out" | "destination-atop"
  | "lighter" | "copy" | "xor" | "multiply" | "screen" | "overlay" | "darken"
  | "lighten" | "color-dodge" | "color-burn" | "hard-light" | "soft-light"
  | "difference" | "exclusion" | "hue" | "saturation" | "color" | "luminosity";
  
export const BlendingModes: BlendingMode[] = [
  "color",
  "color-burn",
  "color-dodge",
  "copy",
  "darken",
  "destination-atop",
  "destination-in",
  "destination-out",
  "destination-over",
  "difference",
  "exclusion",
  "hard-light",
  "hue",
  "lighten",
  "lighter",
  "luminosity",
  "multiply",
  "overlay",
  "saturation",
  "screen",
  "soft-light",
  "source-atop",
  "source-in",
  "source-out",
  "source-over",
  "xor",
];

export type TilingPattern = "normal" | "half-drop" | "half-brick" | "mirror" | "wacky";
export const TilingPatterns: TilingPattern[] = [  
  "normal",
  "half-drop",
  "half-brick",
  "mirror",
  "wacky"
];
export type PaperSizeId = "letter" | "letter" | "legal" | "legal";

type PaperSize = {
    id: PaperSizeId,
    AR: number,
    label: string
}

export const PaperSizes: PaperSize[] = [
  {
    id: "letter",
    AR: 8.5/11,
    label: 'Letter (8.5x11")'
  },
  {
    id: "legal",
    AR: 8.5/14,
    label: 'Legal (8.5x14")'
  }
];

export const PaperSizeById: {[id in PaperSizeId]: PaperSize} =
  PaperSizes.reduce((acc,paperSize) => {
    acc[paperSize.id] = paperSize;
    return acc;
  }, {} as {[id in PaperSizeId]: PaperSize});