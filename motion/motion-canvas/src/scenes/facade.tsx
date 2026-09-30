import {Circle, Gradient, Img, Line, Node, Pattern, Rect, Txt, blur, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  createRef,
  createSignal,
  delay,
  easeInOutCubic,
  easeInOutSine,
  easeOutCubic,
  loop,
  sequence,
  useRandom,
  useScene,
  type ThreadGenerator,
} from '@motion-canvas/core';
import {brand as defaults, type Brand} from '../brand';

type V2 = [number, number];

// ('#FFC478', 0.4) → 'rgba(255,196,120,0.4)'
const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// Fonts come from local files (public/fonts) — never a CDN.
const loadFonts = (b: Brand) =>
  Promise.all(
    [new FontFace('BrandLatin', `url(${b.fontLatin})`), new FontFace('BrandArabic', `url(${b.fontArabic})`)].map(f =>
      f.load().then(() => document.fonts.add(f)),
    ),
  );

const rect = (x0: number, y0: number, x1: number, y1: number): V2[] => [[x0, y1], [x0, y0], [x1, y0], [x1, y1], [x0, y1]];

// Minimal modern villa: lower volume, cantilevered upper volume, roof slab, glazing.
const GROUND = 150;
const OUTLINES: V2[][] = [
  [[-560, GROUND], [560, GROUND]],
  [[-380, GROUND], [-380, 20], [200, 20], [200, GROUND]],
  rect(-200, -110, 380, 20),
  rect(-230, -122, 410, -110),
  rect(-160, -84, 340, -12),
  [[-60, GROUND], [-60, 52], [120, 52], [120, GROUND]],
  ...[-98, -35, 28, 90, 153, 215, 278].map((x): V2[] => [[x, -84], [x, -12]]),
  [[30, 52], [30, GROUND]],
];

export default makeScene2D(function* (view) {
  const vars = useScene().variables;
  const b = Object.fromEntries(Object.entries(defaults).map(([k, v]) => [k, vars.get(k, v)()])) as Brand;
  yield loadFonts(b);

  const root = createRef<Node>();
  const lines = createRef<Node>();
  const logo = createRef<Img>();
  const en = createRef<Txt>();
  const ar = createRef<Txt>();
  const tracking = createSignal(b.tracking * 2.2);

  // Light volume: polygon with a falloff from its source edge (y0) to y1, added on top ('lighter').
  const falloff = (points: V2[], y0: number, y1: number, a: number) => (
    <Line
      points={points}
      closed
      compositeOperation="lighter"
      fill={
        new Gradient({
          from: [0, y0],
          to: [0, y1],
          stops: [
            {offset: 0, color: rgba(b.glow, a)},
            {offset: 0.4, color: rgba(b.glow, a * 0.3)},
            {offset: 1, color: rgba(b.glow, 0)},
          ],
        })
      }
    />
  );

  // Linear LED strip: the glowing line draws on, then its light spills out.
  const strip = (from: V2, to: V2, spill: Node) => {
    const line = createRef<Line>();
    const light = createRef<Node>();
    root().add(
      <Node>
        <Node ref={light} opacity={0} filters={[blur(5)]}>
          {spill}
        </Node>
        <Line ref={line} points={[from, to]} stroke={b.glow} lineWidth={2.5} shadowColor={b.glow} shadowBlur={14} end={0} />
      </Node>,
    );
    return (): ThreadGenerator => all(line().end(1, 0.55, easeInOutCubic), delay(0.15, light().opacity(1, 0.6, easeOutCubic)));
  };

  // Ground uplight grazing the wall: cone + hot spot, flickers on like a real driver.
  const uplight = (x: number, top: number) => {
    const n = createRef<Node>();
    root().add(
      <Node ref={n} opacity={0} filters={[blur(2)]}>
        {falloff([[x - 5, GROUND], [x + 5, GROUND], [x + 34, top], [x - 34, top]], GROUND, top, 0.55)}
        <Circle x={x} y={GROUND - 2} size={7} fill={b.ink} shadowColor={b.glow} shadowBlur={18} />
      </Node>,
    );
    return (): ThreadGenerator => n().opacity(0.8, 0.05).to(0.15, 0.07).to(1, 0.35, easeOutCubic);
  };

  // Film grain (soft-light) to hide gradient banding on dark frames.
  const grainTile = () => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(256, 256);
    const rnd = useRandom(7);
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = img.data[i + 1] = img.data[i + 2] = rnd.nextInt(40, 216);
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  };

  view.fill('#121416'); // dusk → night
  const k = view.width() / 1280; // authored at 1280x720; any 16:9 resolution just scales up
  view.add(<Node ref={root} scale={k} />); // camera: everything lives under root for a slow push-in
  const interior = createRef<Rect>();
  root().add(<Rect ref={interior} x={90} y={-48} size={[500, 72]} fill={rgba(b.glow, 0.07)} opacity={0} />);
  const fascia = strip([-230, -110], [410, -110], falloff(rect(-200, -110, 380, 20), -110, 20, 0.42));
  const soffit = strip(
    [200, 20],
    [380, 20],
    <Node>
      {falloff([[200, 20], [380, 20], [430, GROUND], [150, GROUND]], 20, GROUND, 0.22)}
      <Circle
        x={290}
        y={GROUND}
        size={40}
        scale={[8, 0.8]}
        compositeOperation="lighter"
        fill={new Gradient({type: 'radial', toRadius: 20, stops: [{offset: 0, color: rgba(b.glow, 0.35)}, {offset: 1, color: rgba(b.glow, 0)}]})}
      />
    </Node>,
  );
  const ups = [-330, -210, -130].map(x => uplight(x, 20));
  root().add(
    <Node ref={lines}>
      {OUTLINES.map(points => (
        <Line points={points} stroke={b.muted} lineWidth={1.2} lineJoin="miter" end={0} />
      ))}
    </Node>,
  );
  root().add(
    <>
      <Img ref={logo} src={b.logo} size={b.logoSize} y={-240} opacity={0} />
      <Txt
        ref={en}
        text={b.taglineEn}
        fontFamily="BrandLatin"
        fontWeight={200}
        fontSize={17}
        letterSpacing={() => tracking() * 17}
        x={() => (tracking() * 17) / 2}
        y={218}
        fill={b.ink}
        opacity={0}
        textWrap={false}
      />
      <Txt ref={ar} text={b.taglineAr} fontFamily="BrandArabic" fontWeight={300} fontSize={20} y={268} fill={b.muted} opacity={0} textWrap={false} />
    </>,
  );

  const grain = createRef<Rect>();
  view.add(
    <Rect
      ref={grain}
      size={[view.width() + 256, view.height() + 256]}
      fill={new Pattern({image: grainTile(), repetition: 'repeat'})}
      compositeOperation="soft-light"
      opacity={0.35}
    />,
  );
  const rnd = useRandom(11);
  yield loop(function* () {
    grain().position([rnd.nextInt(-128, 128), rnd.nextInt(-128, 128)]);
    yield;
  });

  yield* all(
    root().scale(1.05 * k, 4, easeInOutSine),
    sequence(0.06, ...lines().children().map(l => (l as Line).end(1, 0.6, easeInOutCubic))),
    delay(1.0, all(view.fill(b.background, 0.9, easeInOutSine), lines().opacity(0.5, 0.9))),
    delay(1.25, fascia()),
    delay(1.55, soffit()),
    delay(1.6, interior().opacity(1, 0.8)),
    delay(1.8, sequence(0.14, ...ups.map(u => u()))),
    delay(2.35, all(logo().opacity(1, 0.8, easeOutCubic), logo().y(-252, 0.9, easeOutCubic))),
    delay(2.5, all(en().opacity(1, 0.8, easeOutCubic), tracking(b.tracking, 1.2, easeOutCubic))),
    delay(2.8, all(ar().opacity(1, 0.8, easeOutCubic), ar().y(258, 0.8, easeOutCubic))),
  );
});
