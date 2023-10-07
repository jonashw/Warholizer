import { ImagePayload } from "./ImageUtil";

export type Position = {x:number, y: number };
export type Offset = Position;
export type TilingPattern = {
  id: string,
  label: string,
  getStyle: (w: number,h: number) => string,
  splits: ('x'|'y')[]
};
const normal = {
  id: 'Normal',
  label: 'Normal', 
  splits: [],
  getStyle: (w: number,h:number) => ''
};
export const tilingPatterns: TilingPattern[] = [
  normal,
  {
    id: 'HalfDrop',
    label: 'Half Drop',
    splits:['x','y'],
    getStyle: (w,h) => `.frame:nth-child(2n) { background-position-y: -${h/2}px; }`
  },
  {
    id: 'HalfBrick',
    label: 'Half Brick',
    splits:['y','x'],
    getStyle: (w,h) => `.row:nth-child(2n) > .frame { background-position-x: -${w/2}px; }`
  }
];
export const TILINGPATTERN = tilingPatterns.reduce((dict,tp) => {
  dict[tp.id] = tp;
  return dict;
},{} as {[id: string]: TilingPattern});

export const defaultTilingPattern = normal;