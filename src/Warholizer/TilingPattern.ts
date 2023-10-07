export type Position = {x:number, y: number };
export type Offset = Position;
export type TilingPattern = {
  id: string,
  label: string,
  splits: ('x'|'y')[],
  nthRow: string,
  nthCol: string,
  offsetDimension: string,
  offset: (w: number, h: number) => number
};
const normal: TilingPattern = {
  id: 'Normal',
  label: 'Normal', 
  splits: [],
  nthRow:'n',
  nthCol:'n',
  offsetDimension: 'x',
  offset: (w:number ,h:number ) => 0
};
export const tilingPatterns: TilingPattern[] = [
  normal,
  {
    id: 'HalfDrop',
    label: 'Half Drop',
    splits:['x','y'],
    nthRow:'n',
    nthCol:'2n',
    offsetDimension: 'y',
    offset: (w:number ,h:number ) => h/2
  },
  {
    id: 'HalfBrick',
    label: 'Half Brick',
    splits:['y','x'],
    nthRow:'2n',
    nthCol:'n',
    offsetDimension: 'x',
    offset: (w:number ,h:number ) => w/2
  }
];
export const TILINGPATTERN = tilingPatterns.reduce((dict,tp) => {
  dict[tp.id] = tp;
  return dict;
},{} as {[id: string]: TilingPattern});

export const defaultTilingPattern = normal;