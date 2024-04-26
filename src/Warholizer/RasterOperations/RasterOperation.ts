
type Dimension = 'x'|'y';

export type RasterOperation = 
  | { type: "originalImage" }
  | {
    type:"wrap",
    dimension: Dimension,
    amount: number,
    input: RasterOperation
  }
  | {
    type: "stack",
    dimension: Dimension,
    inputs: RasterOperation[]
  }
  | {
    type: "scale",
    x: number,
    y: number,
    input: RasterOperation
  };
