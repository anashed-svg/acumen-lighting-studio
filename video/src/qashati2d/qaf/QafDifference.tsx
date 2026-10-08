// «الفرق بالـ ق» — the spot. Choreography only: every state is a pure function of the frame (timeline in spec.ts).
// Layers (back → front):
//   screen: QashtaPaper (parallax 0.55) · ChiliPaper clipped to (bloom ∖ wave) in screen space
//   world (camera, on ones): bloom edge · qashta cup · chili cup (clipped: rising level, then outside the wave) ·
//          cup flames · wave crest · spoon · the big word (+ its flames, sparks) · drops splash · puffs · hand · bubble
//   screen: the title lines · paper grain · end card
import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {
  C,
  clamp01,
  CUP_ANCHORS,
  cupPoint,
  easeInCubic,
  easeInOutCubic,
  easeOutCubic,
  EndCard2D,
  ENDCARD_DURATION,
  FlameArt,
  Glint,
  HeroCup2D,
  jiggle,
  onTwos,
  PaperGrain,
  POP_KEYS,
  Pt,
  rng,
  SpeechBubble,
  SpoonArt,
} from '../kit/lib';
import {BloomEdge, ChiliPaper, ptsToPath, QashtaPaper, spreadPts, WaveCrest} from './parts/Backdrop';
import {camAt, camCss, parallax, shakeAt, toScreen} from './parts/camera';
import {FlickHandArt, FlickPose, NAIL_COCKED} from './parts/FlickHand';
import {RUNS} from './parts/glyphs';
import {DropState, Puff, QAF_DROPS, QafState, QafWord, WORD_FLAMES, wordGeom} from './parts/QafWord';
import {VectorLine} from './parts/VectorTitle';
import {COPY, L, T} from './spec';

export type QafDifferenceProps = {audio: string | null};

// ------------------------------------------------------------------------------------------------ fixed geometry
const WG = wordGeom(L.word.cx, L.word.baseline, L.word.k);
const QAF_HOME = WG.qafPivot;
const WORD_C: Pt = [L.word.cx, L.word.baseline - 90];
const CUP = L.cup;
const cupAt = (p: Pt) => cupPoint(p, CUP.x, CUP.base, CUP.scale);
const cupArtY = (y: number) => CUP.base + (y - 930) * CUP.scale;
// the spoon's waiting pose = HeroCup2D's 'dipping' pose at spoonT 0 (depth −240 along its 28° axis), so the hand-over
// to the cup's own spoon at the dive is seamless
const SPOON_ANG = 28;
const SPOON_U: Pt = [Math.sin((SPOON_ANG * Math.PI) / 180), -Math.cos((SPOON_ANG * Math.PI) / 180)];
const SPOON_BOWL = cupAt([CUP_ANCHORS.spoonEntry[0] + SPOON_U[0] * 240, CUP_ANCHORS.spoonEntry[1] + SPOON_U[1] * 240]);
const HAND_TARGET: Pt = [772, 604]; // where the cocked nail sits (just under the ق's loop)
const HAND_ANGLE = 15; // fingers up and a little right → the ق flies up-right, the arm runs straight down
const HAND_SCALE = 0.95;
const HAND_NAIL: Pt = NAIL_COCKED;
const HAND_ARM: Pt = [Math.sin(0.36 - (HAND_ANGLE * Math.PI) / 180), Math.cos(0.36 - (HAND_ANGLE * Math.PI) / 180)];

const BLOOM_R = 2200;
const WAVE_R = 2400;

// boomerang path (world): in from the top-left, loops over the top, drops onto its place
const BOOM: Pt[] = [
  [-260, 300],
  [160, -360],
  [1220, -60],
  QAF_HOME,
];
const bez = (t: number): Pt => {
  const u = 1 - t;
  const [a, b, c, d] = BOOM;
  return [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
  ];
};

// ------------------------------------------------------------------------------------------------ choreography
const qafState = (f2: number): {qaf: QafState; ghosts: QafState[]} => {
  if (f2 < T.flick) return {qaf: {show: true}, ghosts: []};
  if (f2 < T.whistle) {
    const t = f2 - T.flick;
    if (t > 16) return {qaf: {show: false}, ghosts: []};
    return {qaf: {show: true, dx: 15 * t, dy: -90 * t + 1.3 * t * t, rot: 41 * t, s: 1 + 0.03 * t, sx: t === 0 ? 0.8 : 1, sy: t === 0 ? 1.25 : 1}, ghosts: []};
  }
  if (f2 < T.qafSlam) {
    const tt = (f2 - T.whistle) / (T.qafSlam - T.whistle);
    const t = easeInCubic(tt) * 0.55 + tt * 0.45;
    const p = bez(t);
    const st = (tq: number): QafState => {
      const q = bez(tq);
      return {show: true, dx: q[0] - QAF_HOME[0], dy: q[1] - QAF_HOME[1], rot: -1080 * (1 - tq) ** 1.2, s: 0.4 + 0.85 * tq};
    };
    void p;
    const ghosts = tt > 0.25 ? [st(Math.max(0, t - 0.09)), st(Math.max(0, t - 0.17))] : [];
    return {qaf: st(t), ghosts};
  }
  // slam: impact squash keys on twos, then home
  const k = (f2 - T.qafSlam) / 2;
  const keys = [
    {s: 1.08, sx: 1.3, sy: 0.7},
    {s: 1, sx: 0.88, sy: 1.14},
    {s: 1, sx: 1.05, sy: 0.96},
    {s: 1, sx: 0.98, sy: 1.02},
  ];
  const kk = keys[Math.min(keys.length - 1, k)] ?? {s: 1, sx: 1, sy: 1};
  return {qaf: {show: true, ...(k < keys.length ? kk : {s: 1, sx: 1, sy: 1})}, ghosts: []};
};

const dropHome = (i: number): Pt => WG.at(RUNS.qashta.glyphs[3].x + QAF_DROPS[i].x, QAF_DROPS[i].y);

const dropsState = (f2: number): {drops: [DropState, DropState]; free: boolean} => {
  if (f2 < T.flick) {
    // nerves: the drops shiver while the finger winds up (they know)
    const a = 1 + f2 / 6;
    const s = (f2 / 2) % 2 ? 1 : -1;
    return {
      drops: [
        {show: true, dx: 1.6 * a * s, dy: f2 === 6 ? -7 : 0, rot: 4 * s},
        {show: true, dx: -1.6 * a * s, dy: f2 === 8 ? -7 : 0, rot: -4 * s},
      ],
      free: false,
    };
  }
  if (f2 < T.whistle) {
    // ride the flying ق, stretched with fright
    return {drops: [{show: true, stretch: 0.25, dy: -6}, {show: true, stretch: 0.3, dy: -9}], free: false};
  }
  const lag = [0.12, 0.2];
  // where each drop hangs at the slam: straight above its home on the ق, in frame (then it falls in)
  const ABOVE: Pt[] = [
    [-24, -300],
    [34, -430],
  ];
  const at = (i: number, f: number): Pt => {
    const tt = (f - T.whistle) / (T.qafSlam - T.whistle);
    const t = easeInCubic(tt) * 0.55 + tt * 0.45;
    const p = bez(Math.max(0, t - lag[i]));
    // trail the ق's path (lighter, flung outward), then peel off to hang above their places
    const tr: Pt = [p[0] + (i ? 40 : -20), p[1] - 70 - i * 50];
    const h = dropHome(i);
    const ab: Pt = [h[0] + ABOVE[i][0], h[1] + ABOVE[i][1]];
    const w = easeInOutCubic(clamp01((tt - 0.5) / 0.5));
    return [tr[0] + (ab[0] - tr[0]) * w, tr[1] + (ab[1] - tr[1]) * w];
  };
  const out = [0, 1].map((i): DropState => {
    const home = dropHome(i);
    const land = T.dotLand[i];
    if (f2 < T.qafSlam) {
      const tt = (f2 - T.whistle) / (T.qafSlam - T.whistle);
      if (tt < 0.25 + i * 0.08) return {show: false};
      const p = at(i, f2);
      const w = clamp01((tt - 0.5) / 0.5);
      return {show: true, dx: p[0] - home[0], dy: p[1] - home[1], stretch: 0.15, rot: (((f2 * 23 + i * 90) % 360) - 180) * (1 - w)};
    }
    if (f2 < land) {
      const p0 = at(i, T.qafSlam);
      const u = (f2 - T.qafSlam) / (land - T.qafSlam);
      const g = u * u;
      // fall: settle the spin, stretch with speed
      return {show: true, dx: (p0[0] - home[0]) * (1 - easeOutCubic(u)), dy: (p0[1] - home[1]) * (1 - g), stretch: 0.15 + 0.55 * u, rot: 0};
    }
    const k = (f2 - land) / 2;
    const sq = [0.95, -0.25, 0.3, -0.08, 0][Math.min(4, k)];
    // the joyful hop after the wave
    let hy = 0;
    const ht = f2 - (T.wordHop + i * 4);
    if (ht >= 0 && ht < 10) hy = -4 * 34 * (ht / 10) * (1 - ht / 10);
    return {show: true, squash: Math.max(0, sq), stretch: Math.max(0, -sq), dy: hy};
  }) as [DropState, DropState];
  return {drops: out, free: true};
};

const popScale = (f2: number, at: number) => {
  const p = POP_KEYS[Math.min(POP_KEYS.length - 1, Math.floor((f2 - at) / 2))];
  return f2 < at ? 0 : p.s;
};
const flameScale = (f2: number, at: number, out: number) => {
  if (f2 < at) return 0;
  if (f2 >= out) {
    const k = (f2 - out) / 2;
    return [0.75, 0.35, 0][Math.min(2, k)];
  }
  return popScale(f2, at) * (1 + 0.05 * Math.sin(f2 * 1.3 + at));
};

/** big cartoon sweat drops flicking off the spoon (spoon-local units: bowl at 0,0, handle up), redrawn on twos */
const SweatDrops: React.FC<{f2: number; from: number; amount: number}> = ({f2, from, amount}) => {
  if (amount <= 0 || f2 < from) return null;
  const SPOTS: {p: Pt; d: Pt}[] = [
    {p: [-30, -60], d: [-1, -0.5]},
    {p: [32, -110], d: [1, -0.7]},
    {p: [-20, -170], d: [-1, -0.9]},
    {p: [26, -30], d: [1, -0.2]},
  ];
  return (
    <g>
      {SPOTS.map((sp, j) => {
        const ph = (((f2 - from) + j * 6) % 16) / 16;
        const L = 30 + 110 * ph;
        const x = sp.p[0] + sp.d[0] * L;
        const y = sp.p[1] + sp.d[1] * L + 140 * ph * ph;
        const r = 15 * (1 - 0.35 * ph);
        const a = (Math.atan2(sp.d[1] + 2 * ph, sp.d[0]) * 180) / Math.PI + 90;
        return (
          <g key={j} transform={`translate(${x} ${y}) rotate(${a})`} opacity={amount * (ph < 0.8 ? 1 : (1 - ph) / 0.2)}>
            <path d={`M0 ${-r * 1.9}C${r * 0.5} ${-r * 0.8} ${r} ${-r * 0.2} ${r} ${r * 0.35}C${r} ${r * 1.05} ${-r} ${r * 1.05} ${-r} ${r * 0.35}C${-r} ${-r * 0.2} ${-r * 0.5} ${-r * 0.8} 0 ${-r * 1.9}Z`} fill="#BDF3FF" stroke={C.teal} strokeWidth={3.4} />
            <ellipse cx={-r * 0.35} cy={r * 0.1} rx={r * 0.22} ry={r * 0.36} fill={C.white} />
          </g>
        );
      })}
    </g>
  );
};

// ------------------------------------------------------------------------------------------------ the spot
export const QafDifference: React.FC<QafDifferenceProps> = ({audio}) => {
  const f = useCurrentFrame();
  const f2 = onTwos(f);
  const cam = camAt(f);
  const shake = shakeAt(f, [
    {at: T.flick, amp: 7},
    {at: T.bloom, amp: 8},
    {at: T.qafSlam, amp: 24},
    {at: T.dotLand[0], amp: 5},
    {at: T.dotLand[1], amp: 5},
    {at: T.wave, amp: 9},
    {at: T.title3Qaf + 2, amp: 9},
  ]);
  const bgCam = parallax(cam, 0.55);
  const bgShake: Pt = [shake[0] * 0.5, shake[1] * 0.5];

  // ---- bloom (red) and wave (turquoise) regions, world → screen for the backdrop mask
  // the ink spreads at a drawn, readable pace (not an ease-out flash): 6 drawings for the bloom, 11 for the wave
  const bloomT = f2 < T.bloom ? 0 : clamp01((f2 - T.bloom + 2) / (T.bloomFull - T.bloom + 2)) ** 0.9;
  const waveT = f2 < T.wave ? 0 : clamp01((f2 - T.wave + 2) / (T.waveEnd - T.wave + 2)) ** 1.1;
  const redVisible = bloomT > 0 && waveT < 1;
  const bloomPts = bloomT > 0 && bloomT < 1 ? spreadPts(WORD_C, 60 + bloomT * BLOOM_R, f, 3, 0.11) : null;
  const wavePts = waveT > 0 && waveT < 1 ? spreadPts(QAF_HOME, 40 + waveT * WAVE_R, f, 9, 0.07) : null;
  const scr = (pts: Pt[]) => pts.map((p) => toScreen(cam, p, shake));
  let redClip: string | undefined;
  if (redVisible) {
    const full = 'M-200 -200L1280 -200L1280 2120L-200 2120Z';
    const outer = bloomPts ? ptsToPath(scr(bloomPts)) : full;
    redClip = `path(evenodd, '${outer}${wavePts ? ptsToPath(scr(wavePts)) : ''}')`;
  }

  // ---- cup: chili fill (rising level), then the wave washes it back
  const fillT = f2 < T.cupFill[0] ? 0 : easeInOutCubic(clamp01((f2 - T.cupFill[0]) / (T.cupFill[1] - T.cupFill[0])));
  const chiliOn = fillT > 0 && waveT < 1;
  let chiliClip: string | undefined;
  if (chiliOn) {
    if (fillT < 1) {
      const lvl = cupArtY(940 - fillT * 900);
      const x0 = CUP.x - 330;
      const x1 = CUP.x + 330;
      let d = `M${x0} ${CUP.base + 100}`;
      for (let i = 0; i <= 16; i++) {
        const x = x0 + ((x1 - x0) * i) / 16;
        d += `L${x.toFixed(1)} ${(lvl + 9 * Math.sin(i * 1.3 + f2 * 0.7) + 5 * Math.sin(i * 2.9 - f2)).toFixed(1)}`;
      }
      d += `L${x1} ${CUP.base + 100}Z`;
      chiliClip = `path('${d}')`;
    } else if (wavePts) {
      chiliClip = `path(evenodd, 'M-1000 -1000L3000 -1000L3000 3000L-1000 3000Z${ptsToPath(wavePts)}')`;
    }
  }
  const qashtaHoney = f2 < T.wave ? 1 : f2 < T.honey[0] ? 0 : easeInOutCubic(clamp01((f2 - T.honey[0]) / (T.honey[1] - T.honey[0])));
  const cupFlameOut = T.cupFlamesOut;
  const cupFlames = [T.cupFlames[0], T.cupFlame3, T.cupFlames[1]].map((at) => flameScale(f2, at, cupFlameOut));

  // ---- spoon (stand-alone until the dive, then the cup's own spoon takes over)
  const diving = f2 >= T.spoonDive[0];
  const sweat = f2 < T.sweat ? 0 : f2 < T.waveOverCup ? clamp01((f2 - T.sweat) / 6) : 0;
  const melt = f2 < T.melt[0] ? 0 : f2 < T.spoonBoing ? 0.75 * easeInOutCubic(clamp01((f2 - T.melt[0]) / (T.melt[1] - T.melt[0]))) : 0;
  let spoonShift = 0;
  if (f2 < T.spoonGasp) spoonShift = 5 * Math.sin(f2 * 0.3); // hovering, hopeful
  else if (f2 < T.spoonBoing) {
    const k = (f2 - T.spoonGasp) / 2;
    spoonShift = [36, 44, 40, 36][Math.min(3, k)] - Math.min(36, Math.max(0, f2 - T.melt[0]) * 1.3);
  }
  const gaspStretch = f2 >= T.spoonGasp && f2 < T.spoonGasp + 6 ? [0.18, 0.08, 0.03][Math.floor((f2 - T.spoonGasp) / 2)] : 0;
  const tremble = sweat > 0 ? ((f2 / 2) % 2 ? 1.5 : -1.5) : 0;
  const boing = jiggle(f2, T.spoonBoing, 1, 1.1, 0.2);
  const spoonGlint = clamp01((f - T.spoonGlint) / 12);

  // ---- word
  const {qaf, ghosts} = qafState(f2);
  const {drops, free} = dropsState(f2);
  const shin: 'medial' | 'initial' = f2 >= T.heal && f2 < T.qafSlam ? 'initial' : 'medial';
  const burn = f2 < T.bloom ? 0 : f2 < T.flamesOut ? clamp01((f2 - T.bloom) / 6) : clamp01(1 - (f2 - T.flamesOut) / 8);
  const wordFlames = T.ignite.map((at) => flameScale(f2, at, T.flamesOut));
  const wordSquash = f2 >= T.qafSlam && f2 < T.qafSlam + 8 ? [0.1, -0.05, 0.025, 0][Math.floor((f2 - T.qafSlam) / 2)] : f2 === T.heal ? 0.04 : 0;
  const wordExit = f2 >= T.wordOut ? Math.floor((f2 - T.wordOut) / 2) : -1;
  const plate = f2 >= T.bloom && f2 < T.wave + 8 ? C.chiliDeep : C.turquoiseDeep;

  // ---- hand
  const handOn = f2 < T.handOut[1];
  const pose: FlickPose = f2 < T.flick ? 'cocked' : f2 < T.flick + 2 ? 'smear' : f2 < T.flick + 4 ? 'flicked' : 'relaxed';
  const squeeze = f2 < T.windup ? 0.25 : f2 < T.flick ? clamp01((f2 - T.windup + 2) / 6) : 0;
  const windBack = f2 < T.windup ? 0 : f2 < T.flick ? 14 * clamp01((f2 - T.windup + 2) / 6) : 0;
  const handTremble: Pt = f2 < T.flick ? [((f2 / 2) % 2 ? 1 : -1) * (1 + squeeze * 2.2), ((f2 / 2) % 3) - 1] : [0, 0];
  const out = f2 < T.handOut[0] ? 0 : easeInCubic(clamp01((f2 - T.handOut[0]) / (T.handOut[1] - T.handOut[0]))) * 1100;
  const handT = `translate(${HAND_TARGET[0] + HAND_ARM[0] * (windBack + out) + handTremble[0]} ${HAND_TARGET[1] + HAND_ARM[1] * (windBack + out) + handTremble[1]}) rotate(${HAND_ANGLE}) scale(${HAND_SCALE}) translate(${-HAND_NAIL[0]} ${-HAND_NAIL[1]})`;

  // ---- splashes when the drops land
  const splash = (i: number) => {
    const t = (f2 - T.dotLand[i]) / 10;
    if (t < 0 || t >= 1) return null;
    const h = dropHome(i);
    const r = rng(60 + i);
    return (
      <g key={`sp${i}`}>
        {[0, 1, 2, 3, 4].map((j) => {
          const a = -Math.PI * (0.1 + 0.8 * (j / 4)) + (r() - 0.5) * 0.3;
          const d = 18 + 70 * easeOutCubic(t);
          const y = h[1] + Math.sin(a) * d * 0.8 + 120 * t * t;
          const rr = (7 - j * 0.6) * (1 - t * 0.7);
          return <circle key={j} cx={h[0] + Math.cos(a) * d} cy={y} r={rr} fill={C.cream} stroke={C.teal} strokeWidth={2.4} />;
        })}
      </g>
    );
  };

  return (
    <AbsoluteFill style={{background: C.turquoise, overflow: 'hidden'}}>
      {audio ? <Audio src={staticFile(audio)} /> : null}
      {/* ---------------- backdrops (far plane) */}
      <AbsoluteFill style={{transform: camCss(bgCam, bgShake), transformOrigin: '0 0'}}>
        <QashtaPaper frame={f} />
      </AbsoluteFill>
      {redVisible ? (
        <AbsoluteFill style={{clipPath: redClip}}>
          <AbsoluteFill style={{transform: camCss(bgCam, bgShake), transformOrigin: '0 0'}}>
            <ChiliPaper frame={f} />
          </AbsoluteFill>
        </AbsoluteFill>
      ) : null}

      {/* ---------------- the world (camera) */}
      <AbsoluteFill style={{transform: camCss(cam, shake), transformOrigin: '0 0'}}>
        {bloomPts ? (
          <svg width={1080} height={1920} style={{position: 'absolute', overflow: 'visible'}}>
            <BloomEdge pts={bloomPts} w={9} />
          </svg>
        ) : null}

        <HeroCup2D
          x={CUP.x}
          y={CUP.base}
          scale={CUP.scale}
          honeyProgress={qashtaHoney}
          spoon={!diving ? 'none' : f2 < T.spoonLift[0] ? 'dipping' : 'lifted'}
          spoonT={f2 < T.spoonLift[0] ? clamp01((f2 - T.spoonDive[0]) / (T.spoonDive[1] - T.spoonDive[0])) : clamp01((f2 - T.spoonLift[0]) / (T.spoonLift[1] - T.spoonLift[0]))}
          wobble={jiggle(f2, T.waveOverCup, 0.8, 0.9, 0.2) + (f2 >= T.spoonLift[0] ? jiggle(f2, T.strandSnap, 0.5, 1, 0.25) : 0)}
          squash={jiggle(f2, T.waveOverCup, 0.06, 1, 0.25)}
          glint={clamp01((f - T.cupGlint) / 14)}
          frame={f}
        />
        {chiliOn ? (
          <AbsoluteFill style={{clipPath: chiliClip}}>
            <HeroCup2D x={CUP.x} y={CUP.base} scale={CUP.scale} variant="chili" heat={f2 >= T.cupFill[1] ? 1 : 0} squash={f2 >= T.spoonGasp - 6 ? 0.02 * Math.sin(f2 * 1.7) : 0} frame={f} />
          </AbsoluteFill>
        ) : null}
        <svg width={1080} height={1920} style={{position: 'absolute', overflow: 'visible'}}>
          {CUP_ANCHORS.flames.map((p, i) => {
            const s = cupFlames[i];
            if (s <= 0.01) return null;
            const [x, y] = cupAt(p);
            return (
              <g key={i} transform={`translate(${x} ${y + 14}) scale(${s})`}>
                <FlameArt h={[120, 165, 130][i]} seed={i + 11} frame={f} />
              </g>
            );
          })}
          {CUP_ANCHORS.flames.map((p, i) => {
            const [x, y] = cupAt(p);
            return <Puff key={`cp${i}`} x={x} y={y - 20} t={(f2 - cupFlameOut - i * 2) / 14} size={70} seed={30 + i} />;
          })}
          {wavePts ? <WaveCrest c={QAF_HOME} r={40 + waveT * WAVE_R} frame={f} w={70} /> : null}
        </svg>

        {/* the stand-alone spoon (hopeful → horrified → melted → boing) */}
        {!diving ? (
          <svg width={1080} height={1920} style={{position: 'absolute', overflow: 'visible'}}>
            <g
              transform={`translate(${SPOON_BOWL[0] + SPOON_U[0] * spoonShift + tremble} ${SPOON_BOWL[1] + SPOON_U[1] * spoonShift}) rotate(${SPOON_ANG + boing * 9}) scale(${CUP.scale * (1 - gaspStretch * 0.4 + boing * 0.06)} ${CUP.scale * (1 + gaspStretch - boing * 0.08)})`}
            >
              <SpoonArt melt={melt} sweat={sweat} frame={f} />
              <SweatDrops f2={f2} from={T.sweat} amount={sweat} />
              {spoonGlint > 0 && spoonGlint < 1 ? <Glint x={-6} y={-200} s={Math.sin(Math.PI * spoonGlint)} /> : null}
            </g>
          </svg>
        ) : null}

        {/* the big word */}
        {wordExit < 3 ? (
          <AbsoluteFill
            style={
              wordExit >= 0
                ? {
                    // lifts off the paper: up and towards the camera, three drawings
                    transform: `translateY(${[-6, -22, -46][wordExit]}px) scale(${[1.04, 1.12, 1.22][wordExit]})`,
                    transformOrigin: `${L.word.cx}px ${L.word.baseline - 100}px`,
                    opacity: [1, 0.6, 0.25][wordExit],
                  }
                : undefined
            }
          >
            {ghosts.map((g, i) => (
              <AbsoluteFill key={i} style={{opacity: 0.22 - i * 0.08}}>
                <QafWord frame={f} cx={L.word.cx} baseline={L.word.baseline} k={L.word.k} qaf={g} drops={[{show: false}, {show: false}]} shin={shin} onlyQaf />
              </AbsoluteFill>
            ))}
            <QafWord
              frame={f}
              cx={L.word.cx}
              baseline={L.word.baseline}
              k={L.word.k}
              qaf={qaf}
              drops={drops}
              dropsFree={free}
              shin={shin}
              burn={burn}
              flames={wordFlames}
              plate={plate}
              squash={wordSquash}
              sparks={f2 >= T.flick ? (f - T.flick) / 8 : 0}
            />
            <svg width={1080} height={1920} style={{position: 'absolute', overflow: 'visible'}}>
              {splash(0)}
              {splash(1)}
              {WORD_FLAMES.map((F, i) => {
                const p = WG.at(F.ux, F.uy);
                return <Puff key={i} x={p[0]} y={p[1] - 30} t={(f2 - T.flamesOut - i * 2) / 14} size={80} seed={i + 3} />;
              })}
            </svg>
          </AbsoluteFill>
        ) : null}

        {/* the hand */}
        {handOn ? (
          <svg width={1080} height={1920} style={{position: 'absolute', overflow: 'visible'}}>
            <g transform={handT}>
              <FlickHandArt pose={pose} squeeze={squeeze} frame={f} />
            </g>
          </svg>
        ) : null}

      </AbsoluteFill>

      {/* ---------------- the spoon's line (screen space: it stays put and readable while the camera pushes in) */}
      <SpeechBubble
        x={262}
        y={830}
        text={COPY.bubble}
        start={T.bubble}
        exit={T.bubbleOut}
        shape="burst"
        fontSize={70}
        tail={toScreen(cam, [SPOON_BOWL[0] + SPOON_U[0] * (spoonShift + 120), SPOON_BOWL[1] + SPOON_U[1] * (spoonShift + 120)], shake)}
        rotate={-5}
        seed={11}
        fill={C.flameYellow}
      />

      {/* ---------------- the line (screen space, inside SAFE) */}
      {f2 >= T.title1 - 2 ? (
        <>
          <VectorLine run={RUNS.title1} frame={f} cx={L.title.cx} baseline={L.title.y1} k={L.title.k1} words={[{start: T.title1}, {start: T.title1 + T.titleStagger}]} rotate={-2} />
          <VectorLine
            run={RUNS.title2}
            frame={f}
            cx={L.title.cx}
            baseline={L.title.y2}
            k={L.title.k2}
            words={[{start: T.title1 + 2 * T.titleStagger, exit: T.swapOut}]}
            rotate={-2}
            strike={f2 >= T.strike[0] && f2 < T.swapOut ? clamp01((f2 - T.strike[0] + 2) / (T.strike[1] - T.strike[0])) : 0}
          />
          <VectorLine
            run={RUNS.title3}
            frame={f}
            cx={L.title.cx}
            baseline={L.title.y2}
            k={L.title.k2}
            words={[{start: T.title3}, {start: T.title3Qaf, hops: [...T.qafHops], hopH: 70}]}
            qafGlyph="uni0642"
            rotate={-2}
          />
        </>
      ) : null}

      <Sequence from={T.endCard} durationInFrames={ENDCARD_DURATION}>
        <EndCard2D comment={COPY.comment} grain={false} />
      </Sequence>

      <PaperGrain />
    </AbsoluteFill>
  );
};
