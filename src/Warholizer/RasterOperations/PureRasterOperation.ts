import { Angle, Byte, Percentage } from "./NumberTypes";

export type Dimension = 'x'|'y';
export type Direction = 'up' | 'down' | 'left' | 'right';

export type Invert = { type: "invert" };
export type Noop = { type: "noop" };

export type Threshold = {
  type: "threshold",
  value: Byte
};

export type Wrap = {
  type: "wrap",
  dimension: Dimension,
  amount: Percentage
};

export type Blur = {
  type: "blur",
  pixels: number
};

export type Grayscale = {
  type: "grayscale",
  percent: Percentage
};

export type RotateHue = {
  type: "rotateHue",
  degrees: Angle
}

export type Stack = {
  type: "stack",
  dimension: Dimension
};

export type Scale = {
  type: "scale",
  x: number,
  y: number
};

export type PureRasterOperation = 
  | Wrap 
  | Stack 
  | Scale
  | Noop
  | Blur
  | RotateHue
  | Grayscale
  | Threshold
  | Invert;