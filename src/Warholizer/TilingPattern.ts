export type Position = {x:number, y: number };
export type Offset = Position;
type Flip = {
  rowSelector: string,
  colSelector: string,
  x: boolean,
  y: boolean
};

export type TilingPattern = {
  id: string,
  label: string,
  nthRow: string,
  nthCol: string,
  flips: Flip[],
  offsetDimension: string,
  offset: (w: number, h: number) => number
};

const mirror: TilingPattern = {
  flips: [
    { rowSelector:'odd', colSelector:'odd', x: false, y: false },
    { rowSelector:'odd', colSelector:'even' , x: true , y: false },
    { rowSelector:'even',  colSelector:'odd', x: false, y: true  },
    { rowSelector:'even',  colSelector:'even',  x: true , y: true  },
  ],
  id: 'Mirror',
  label: 'Mirror', 
  nthRow:'n',
  nthCol:'n',
  offsetDimension: 'x',
  offset: (w:number ,h:number ) => 0
};
const normal: TilingPattern = {
  flips: [],
  id: 'Normal',
  label: 'Normal', 
  nthRow:'n',
  nthCol:'n',
  offsetDimension: 'x',
  offset: (w:number ,h:number ) => 0
};
export const tilingPatterns: TilingPattern[] = [
  normal,
  {
    flips: [],
    id: 'HalfDrop',
    label: 'Half Drop',
    nthRow:'n',
    nthCol:'2n',
    offsetDimension: 'y',
    offset: (w:number ,h:number ) => h/2
  },
  {
    flips: [],
    id: 'HalfBrick',
    label: 'Half Brick',
    nthRow:'2n',
    nthCol:'n',
    offsetDimension: 'x',
    offset: (w:number ,h:number ) => w/2
  },
  mirror
];
export const TILINGPATTERN = tilingPatterns.reduce((dict,tp) => {
  dict[tp.id] = tp;
  return dict;
},{} as {[id: string]: TilingPattern});

export const defaultTilingPattern = normal;