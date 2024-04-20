import { RasterOperation } from "./RasterOperations/RasterOperation";

export type Vector = {x:number, y: number };

type Flip = {
  type: 'flip',
  rowSelector: Selector,
  colSelector: Selector,
  x: boolean,
  y: boolean
};

type Selector = 'n' | 'even' | 'odd';
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
  operations: Operation[],
  rasterOperation: RasterOperation
};


const wacky: TilingPattern = {
  id: 'Wacky',
  label: 'Wacky',
  rasterOperation: {
    type:'stack',
    dimension: 'y',
    inputs: [
      {
        type:'stack',
        dimension:'x',
        inputs: [
          {type:'originalImage'},
          {type:'scale',x:-1,y:1, input:{type:'originalImage'}}
        ]
      },
      {
        type:'stack',
        dimension:'x',
        inputs: (() => {
          const wrap: RasterOperation = {
            type:'wrap',
            input:{
              type:'originalImage'
            },
            dimension:'x',
            amount:0.5
          };
          return [
            wrap,
            {type:'scale',x:-1,y:1, input:wrap}
          ];
        })()
      }
    ]
  },

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
      rowSelector:'even',
      colSelector:'n',
      dimension: 'x',
      amount: (w:number ,_:number ) => w/2
    }
  ]
};
const mirror: TilingPattern = {
  id: 'Mirror',
  label: 'Mirror',
  rasterOperation: {
    type:'stack',
    dimension:'y',
    inputs: [
      {
        type:'stack',
        dimension:'x',
        inputs: [
          {type:'scale', x:1, y: 1, input:{type:'originalImage'}},
          {type:'scale', x:-1, y: 1, input:{type:'originalImage'}},
        ]
      },
      {
        type:'stack',
        dimension:'x',
        inputs: [
          {type:'scale', x:1, y: -1, input:{type:'originalImage'}},
          {type:'scale', x:-1, y: -1, input:{type:'originalImage'}},
        ]
      }
    ]
  },
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
  rasterOperation: {type:'originalImage'},
  operations: []
};
export const tilingPatterns: TilingPattern[] = [
  normal,
  {
    id: 'HalfDrop',
    label: 'Half Drop',
    rasterOperation: {
      type: 'stack',
      dimension:'x', 
      inputs: [
        {type:'originalImage'},
        {
          type:"wrap",
          amount:0.5,
          dimension:"y",
          input:{type:'originalImage'}
        }
      ]
    },
    operations: [
      {
        type: 'offset',
        rowSelector:'n',
        colSelector:'even',
        dimension: 'y',
        amount: (_:number ,h:number ) => h/2
      }
    ]
  },
  {
    /*
Half drop
Stack(img,"x",(Wrap(img,"y",0.5))

Half brick
Stack(img,"y",(Wrap(img,"x",0.5))

Mirror
Stack(
Stack(Scale(img,1, 1),"x",Scale(img,-1, 1)),
"y",
Stack(Scale(img,1,-1),"x",(Scale(img,-1,-1))
)
    */
    id: 'HalfBrick',
    label: 'Half Brick',
    rasterOperation: {
      type: 'stack',
      dimension:'y', 
      inputs: [
        {type:'originalImage'},
        {
          type:"wrap",
          amount:0.5,
          dimension:"x",
          input:{type:'originalImage'}
        }
      ]
    },
    operations: [
      {
        type:'offset',
        rowSelector:'even',
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