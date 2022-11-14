export type Paper = {AR: number, label: string, height:number, width: number, cssSize: string}

export const PAPER = {
  "LETTER_PORTRAIT": {
    AR: 8.5/11,
    label: 'Letter Portrait (8.5x11")',
    width:820,
    height:1061,
    cssSize:'letter portrait'
  },
  "LETTER_LANDSCAPE": {
    AR: 11/8.5,
    label: 'Letter Landscape (11x8.5")',
    width:1061,
    height:820,
    cssSize:'letter landscape'
  }
};