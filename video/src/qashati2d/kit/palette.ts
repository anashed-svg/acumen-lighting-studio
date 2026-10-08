// «Qashati 2D» palette — the base colours come from brands/qashati-alsham/CONCEPTS-2D.md; the rest are hand-picked
// shade/light companions (used for cel shading, halftone dots and drawn highlights — never smooth gradients).

export const C = {
  // brand
  turquoise: '#01E8D5', // logo, end card, sticker
  turquoiseDeep: '#00B8A9', // shadows / halftone on turquoise
  turquoiseShade: '#00CDBD',
  turquoiseLight: '#8AF6EC',
  teal: '#053F3B', // THE ink: outlines + text
  tealDark: '#032B28',
  tealSoft: '#2C6C66',

  // paper + cream
  paper: '#F3E6CC',
  paperShade: '#E3D0AC',
  cream: '#FFF7E8', // qashta
  creamShade: '#F1DFBD',
  creamDeep: '#DCC08F',
  white: '#FFFFFF',

  // honey
  honey: '#F4AE22',
  honeyDeep: '#C67A06',
  honeyLight: '#FFD877',

  // fruit
  strawberry: '#F0364F',
  strawberryDeep: '#B21733',
  strawberryCore: '#FFD3D3',
  strawberryMid: '#FF6F80',
  mango: '#FFA41B',
  mangoDeep: '#E2700A',
  mangoLight: '#FFCF55',
  kiwi: '#7CC242',
  kiwiDeep: '#4B8A25',
  kiwiLight: '#B9E27C',
  kiwiCore: '#F3F2C9',
  kiwiSkin: '#7A5A2C',
  seed: '#1D1A13',

  // garnish
  pistachio: '#8DC040',
  pistachioDeep: '#557F22',
  pistachioLight: '#C3E07A',
  pistachioSkin: '#8A4256',

  // chili
  chili: '#E5303A',
  chiliDeep: '#9E101C',
  chiliHot: '#FF6A3D',
  chiliLight: '#FF9C8A',
  flameYellow: '#FFD23F',
  flameOrange: '#FF8A1E',

  // steel spoon
  steel: '#DDE7E8',
  steelShade: '#A9BCBF',
  steelDeep: '#6E8A8E',

  // skin tones for Hand2D (light → deep)
  skin: ['#F6D3B3', '#E9B98F', '#D39A6A', '#B47A4E', '#8A5A36'] as const,
  skinShade: ['#E6B48F', '#D29A6E', '#B67C4F', '#94603A', '#6C4427'] as const,
  henna: '#8E3B1E',
} as const;

// Halftone/ink opacity conventions
export const INK = C.teal;
export const INK_W = {hero: 9, main: 6.5, detail: 3.6, hair: 2.2} as const; // brush widths in art units (≈ px at scale 1)
