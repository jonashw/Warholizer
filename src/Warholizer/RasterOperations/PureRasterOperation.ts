export type Dimension = 'x'|'y';

export type Invert = { type: "invert" };
export type Noop = { type: "noop" };

export type Wrap = {
  type: "wrap",
  dimension: Dimension,
  amount: number
};

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
| Invert;