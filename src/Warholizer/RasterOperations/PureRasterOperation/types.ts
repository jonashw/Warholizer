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
  | Copies
  | Invert
  | Quantize
  | SeparateColors
  | Levels
  | GradientMap
  | Posterize
  | OrderedDither
  | ErrorDiffusion
  | Edges
  | StickerBorder
  | ColorKey
  | CmykChannels
  | ColorHalftone;

export type Dimension = 'x'|'y';
export type Direction = 'up' | 'down' | 'left' | 'right';
export type Invert = { type: "invert" };
/** Reduce to a median-cut palette; `replacements[i]` (hex or null to keep) recolors the i-th darkest color. */
export type Quantize = { type: "quantize", colors: number, replacements: (string | null)[] };
/** One image per palette color (as in Quantize), the rest transparent: screenprint/stencil separations. */
export type SeparateColors = { type: "separateColors", colors: number, replacements: (string | null)[] };
/** Remap tones: `black` and `white` points (0-255) and gamma (> 1 brightens midtones). */
export type Levels = { type: "levels", black: Byte, white: Byte, gamma: number };
/** Brightness mapped through color stops (hex), dark to light; two stops make a duotone. */
export type GradientMap = { type: "gradientMap", stops: string[] };
export type Posterize = { type: "posterize", levels: number };
export type BayerSize = 2 | 4 | 8;
export type OrderedDither = { type: "orderedDither", matrixSize: BayerSize, levels: number, monochrome: boolean, pixelSize: number };
export type DiffusionMethod = 'floyd-steinberg' | 'atkinson';
export type ErrorDiffusion = { type: "errorDiffusion", method: DiffusionMethod, levels: number, monochrome: boolean };
/** Line art from edges: `strength` scales line darkness; `threshold` > 0 makes lines solid. */
export type Edges = { type: "edges", strength: number, threshold: Byte, invert: boolean };
/** A die-cut style border of `width` px around the opaque shape, optionally with a cut line. */
export type StickerBorder = { type: "stickerBorder", width: number, color: string, cutLine: boolean };
/** Makes a color transparent; `color` null keys the average edge color; `connected` keys only regions touching the edges. */
export type ColorKey = { type: "colorKey", color: string | null, tolerance: number, softness: number, connected: boolean };
export type CmykChannels = { type: "cmykChannels" };
/** Ben-Day style CMYK halftone: each ink halftoned at its traditional screen angle, multiplied together. */
export type ColorHalftone = { type: "colorHalftone", dotDiameter: number, blurPixels: number, shape?: DotShape, scale?: number };
export type Void = { type: "void" };
export type Fill = { type: "fill", color: CSSProperties["color"], blendingMode: BlendingMode};
export type Noop = { type: "noop" };
export type Crop = { type: "crop", x: number, y: number, width: number, height: number, unit: 'px' | '%' }
export type Threshold = { type: "threshold", value: Byte };
export type Copies = { type: "copies", n: number };
export type Split = { type: "split", dimension: Dimension, amount: Percentage };
export type SlideWrap = { type: "slideWrap", dimension: Dimension, amount: Percentage };
export type DotShape = 'round' | 'ellipse' | 'line' | 'diamond';
export type HalftoneStyle = 'smooth' | 'classic';
/**
 * `smooth` (default): AM screen with cell size `dotDiameter`, dot area proportional to tone,
 * anti-aliased edges, optional `shape` and output `scale`. `classic`: the original fixed-dot,
 * thresholded look (`dotsOnly` applies only here).
 */
export type Halftone = {
  type: "halftone", angle: Angle, dotDiameter: number, blurPixels: number, dotsOnly?: boolean, invert?: boolean,
  style?: HalftoneStyle, shape?: DotShape, scale?: number
};
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