export type Vector = {x:number, y: number };

type Flip = {
  type: 'flip',
  rowSelector: Selector,
  colSelector: Selector,
  x: boolean,
  y: boolean
};

type Selector = '2n' | 'n' | 'even' | 'odd';
type Dimension = 'x'|'y';
type Offset = {
  type: 'offset',
  rowSelector: Selector,
  colSelector: Selector,
  dimension: Dimension,
  amount: (w: number, h: number) => number
};

type Operation = Offset | Flip;

export type TilingPattern = {
  id: string,
  label: string,
  operations: Operation[]
};


const wacky: TilingPattern = {
  id: 'Wacky',
  label: 'Wacky',
  operations: [
    {
      type: 'flip',
      rowSelector:'odd',
      colSelector:'odd',
      x: false,
      y: false 
    },
    {
      type: 'flip',
      rowSelector:'n',
      colSelector:'even',
      x: true,
      y: false 
    },
    {
      type: 'offset',
      rowSelector:'2n',
      colSelector:'n',
      dimension: 'x',
      amount: (w:number ,_:number ) => w/2
    }
  ]
};
const mirror: TilingPattern = {
  id: 'Mirror',
  label: 'Mirror',
  operations: [
    { type:'flip',rowSelector:'odd' , colSelector:'odd' , x: false, y: false },
    { type:'flip',rowSelector:'odd' , colSelector:'even', x: true , y: false },
    { type:'flip',rowSelector:'even', colSelector:'odd' , x: false, y: true  },
    { type:'flip',rowSelector:'even', colSelector:'even', x: true , y: true  },
  ]
};
const normal: TilingPattern = {
  id: 'Normal',
  label: 'Normal', 
  operations: []
};
export const tilingPatterns: TilingPattern[] = [
  normal,
  {
    id: 'HalfDrop',
    label: 'Half Drop',
    operations: [
      {
        type: 'offset',
        rowSelector:'n',
        colSelector:'2n',
        dimension: 'y',
        amount: (_:number ,h:number ) => h/2
      }
    ]
  },
  {
    id: 'HalfBrick',
    label: 'Half Brick',
    operations: [
      {
        type:'offset',
        rowSelector:'2n',
        colSelector:'n',
        dimension: 'x',
        amount: (w:number ,_:number ) => w/2
      }
    ]
  },
  mirror,
  wacky
];
export const TILINGPATTERN = tilingPatterns.reduce((dict,tp) => {
  dict[tp.id] = tp;
  return dict;
},{} as {[id: string]: TilingPattern});

export const defaultTilingPattern = normal;