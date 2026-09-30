import {Gradient, Img, Line, Node, Path, Pattern, Rect, SVG, Txt, blur, makeScene2D} from '@revideo/2d';
import {
  all,
  createRef,
  createSignal,
  delay,
  easeInOutCubic,
  easeInOutSine,
  easeOutCubic,
  loop,
  Random,
  sequence,
  useScene,
} from '@revideo/core';
import {brand as defaults, type Brand} from '../brand';

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

// Film grain tile: soft-light noise hides gradient banding and keeps blacks black.
const grainTile = (size = 256) => {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const rnd = new Random(7);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = img.data[i + 1] = img.data[i + 2] = rnd.nextInt(40, 216);
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
};

const band = (color: string, a: number, w: number) =>
  new Gradient({
    from: [-w / 2, 0],
    to: [w / 2, 0],
    stops: [
      {offset: 0, color: rgba(color, 0)},
      {offset: 0.5, color: rgba(color, a)},
      {offset: 1, color: rgba(color, 0)},
    ],
  });

export default makeScene2D('logoReveal', function* (view) {
  const vars = useScene().variables;
  const b = Object.fromEntries(Object.entries(defaults).map(([k, v]) => [k, vars.get(k, v)()])) as Brand;
  const isSvg = /\.svg($|\?)/i.test(b.logo);
  yield loadFonts(b);
  let svgText = '';
  if (isSvg) svgText = yield fetch(b.logo).then(r => r.text());

  const S = b.logoSize;
  const logoY = -70;
  const ledY = logoY + S / 2 + 42;
  const enY = ledY + 44;
  const arY = enY + 46;
  const Logo = (ref: (n: Node) => void, opacity = 1) =>
    isSvg ? <SVG ref={ref} svg={svgText} size={S} /> : <Img ref={ref} src={b.logo} size={S} opacity={opacity} />;

  const root = createRef<Node>();
  const ambient = createRef<Rect>();
  const beam = createRef<Rect>();
  const grain = createRef<Rect>();
  const bloom = createRef<Node>();
  const sweep = createRef<Rect>();
  const led = createRef<Line>();
  const en = createRef<Txt>();
  const ar = createRef<Txt>();
  let logo: Node, glowCopy: Node;
  const tracking = createSignal(b.tracking * 2.2);

  view.fill(b.background);
  view.add(
    <Node ref={root}>
      <Rect
        ref={ambient}
        size={[1400, 900]}
        opacity={0}
        fill={
          new Gradient({
            type: 'radial',
            from: [0, 40],
            to: [0, 40],
            toRadius: 600,
            stops: [
              {offset: 0, color: rgba(b.glow, 0.2)},
              {offset: 0.45, color: rgba(b.glow, 0.05)},
              {offset: 1, color: rgba(b.glow, 0)},
            ],
          })
        }
      />
      {/* wall-washer beam raking across the whole frame */}
      <Rect ref={beam} size={[560, 1800]} rotation={18} x={-1100} fill={band(b.glow, 0.09, 560)} compositeOperation="lighter" />
      <Node ref={bloom} y={logoY} opacity={0} filters={[blur(20)]} compositeOperation="lighter">
        {Logo(n => (glowCopy = n))}
      </Node>
      {/* cache + source-atop: the light band only lands on the logo's pixels */}
      <Node cache y={logoY}>
        {Logo(n => (logo = n), 0)}
        <Rect
          ref={sweep}
          size={[S * 0.45, S * 2]}
          rotation={18}
          x={-S * 1.2}
          compositeOperation="source-atop"
          fill={band(b.glow, 1, S * 0.45)}
        />
      </Node>
      <Line
        ref={led}
        points={[[-S * 0.42, 0], [S * 0.42, 0]]}
        y={ledY}
        stroke={b.glow}
        lineWidth={2}
        shadowColor={b.glow}
        shadowBlur={16}
        start={0.5}
        end={0.5}
      />
      <Txt
        ref={en}
        text={b.taglineEn}
        fontFamily="BrandLatin"
        fontWeight={200}
        fontSize={19}
        letterSpacing={() => tracking() * 19}
        x={() => (tracking() * 19) / 2} // trailing tracking shifts text left
        y={enY}
        fill={b.ink}
        opacity={0}
        textWrap={false}
      />
      <Txt
        ref={ar}
        text={b.taglineAr}
        fontFamily="BrandArabic"
        fontWeight={300}
        fontSize={22}
        y={arY + 10}
        fill={b.muted}
        opacity={0}
        textWrap={false}
      />
    </Node>,
  );
  view.add(
    <Rect
      ref={grain}
      size={[1280 + 256, 720 + 256]}
      fill={new Pattern({image: grainTile(), repetition: 'repeat'})}
      compositeOperation="soft-light"
      opacity={0.35}
    />,
  );

  const paths = isSvg ? ((logo as SVG).wrapper.children() as Path[]) : [];
  for (const p of paths) {
    p.fill(rgba(b.ink, 0)).stroke(b.glow).lineWidth(1.6 / Math.abs(p.absoluteScale().x)).end(0);
  }
  if (isSvg) {
    for (const p of (glowCopy as SVG).wrapper.children() as Path[]) p.fill(b.glow);
  }

  const drawIn = isSvg
    ? sequence(0.07, ...paths.map((p, i) => p.end(1, i === 0 ? 1.4 : 0.9, easeInOutCubic)))
    : logo.opacity(1, 1.4, easeInOutSine);
  const settle = all(...paths.map(p => all(p.fill(b.ink, 0.8, easeInOutSine), p.lineWidth(0, 0.8))));

  const rnd = new Random(11);
  yield loop(function* () {
    grain().position([rnd.nextInt(-128, 128), rnd.nextInt(-128, 128)]);
    yield;
  });

  yield* all(
    delay(0.7, beam().x(1100, 2.6, easeInOutSine)),
    root().scale(1.04, 4, easeInOutSine),
    ambient().opacity(1, 1.6, easeInOutSine),
    delay(0.15, drawIn),
    delay(1.3, settle),
    delay(1.35, sweep().x(S * 1.2, 1.3, easeInOutCubic)),
    delay(1.45, bloom().opacity(0.5, 0.5, easeOutCubic).to(0.16, 0.9, easeInOutSine)),
    delay(1.8, all(led().start(0, 0.9, easeInOutCubic), led().end(1, 0.9, easeInOutCubic))),
    delay(2.1, all(en().opacity(1, 0.9, easeOutCubic), tracking(b.tracking, 1.3, easeOutCubic))),
    delay(2.45, all(ar().opacity(1, 0.9, easeOutCubic), ar().y(arY, 0.9, easeOutCubic))),
  );
});
