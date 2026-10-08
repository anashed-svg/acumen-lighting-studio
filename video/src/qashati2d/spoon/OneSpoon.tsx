// «ملعقة وحدة بس» — the scene. Read spec.ts first (story, timeline, copy, cue list).
// Layers (back → front): table + plate (h 0) · hand shadows on the table · hands (each at its own height: dolly
// parallax) · bubbles / counter / title (screen space) · end card · paper grain LAST.
import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {C, EndCard2D, ENDCARD_DURATION, FamilyPlate2D, INK, InkTitle, jiggle, onTwos, PaperGrain, Pt, SpeechBubble} from '../kit/lib';
import {FAMILY, FamilyHand} from './art/FamilyHand';
import {DigSplash, SpeedLines} from './art/Fx';
import {PhoneProp} from './art/PhoneProp';
import {SpoonCounter} from './art/SpoonCounter';
import {Tablecloth} from './art/Tablecloth';
import {Cam, camAt, layerTransform, project} from './camera';
import {biteTarget, counterFlips, DROP_WORLD, handPose, ownerPose, Pose, plateTaken, snatchPose} from './motion';
import {COPY, HAND_SCALE, HANDS, LAYOUT, PLATE, T} from './spec';

/** light comes from the upper left: a shadow falls this far (world px) per unit of height */
const LIGHT: Pt = [0.3, 0.42];

const Layer: React.FC<{cam: Cam; h: number; children: React.ReactNode; z?: number}> = ({cam, h, children, z}) => (
  <div style={{position: 'absolute', left: 0, top: 0, width: 0, height: 0, transformOrigin: '0 0', transform: layerTransform(cam, h), zIndex: z}}>{children}</div>
);

/** wraps a hand in its smear (stretch along the motion, on twos) */
const Smear: React.FC<{p: Pose; children: React.ReactNode}> = ({p, children}) => {
  if (p.smear <= 1.001) return <>{children}</>;
  const a = (Math.atan2(p.vel[1], p.vel[0]) * 180) / Math.PI;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 0, height: 0, transformOrigin: `${p.x}px ${p.y}px`, transform: `rotate(${a}deg) scale(${p.smear}, ${1 / Math.sqrt(p.smear)}) rotate(${-a}deg)`}}>
      {children}
    </div>
  );
};

type HandSpec = {key: string; pose: Pose; preset: keyof typeof FAMILY; garnish: 'strawberry' | 'mango' | 'kiwi' | 'drop' | 'none'; phone?: boolean};

export const OneSpoon: React.FC<{music: string | null}> = ({music}) => {
  const f = useCurrentFrame();
  const f2 = onTwos(f);
  const cam = camAt(f, T.snatchGrab, T.ownerStop);
  const taken = plateTaken(f);

  // who is on stage
  const hands: HandSpec[] = [];
  HANDS.forEach((b, i) => {
    const p = handPose(i, f);
    if (p.visible) hands.push({key: b.id, pose: p, preset: b.id, garnish: b.garnish, phone: b.id === 'teen'});
  });
  const owner = ownerPose(f);
  if (owner.visible) hands.push({key: 'owner', pose: owner, preset: 'owner', garnish: 'none'});
  const snatch = snatchPose(f);
  if (snatch.visible) hands.push({key: 'snatch', pose: snatch, preset: 'kid', garnish: 'drop'});

  // the last drop: it wobbles alone in the silence (two little jelly shivers), then the kid takes it
  const dropWobble = jiggle(f2, T.silenceEnd + 6, 1, 0.9, 0.18) + jiggle(f2, T.silenceEnd + 22, 0.7, 0.9, 0.2) + (f2 >= T.ownerStop && f2 < T.ownerStop + 10 ? jiggle(f2, T.ownerStop, 0.6, 1.1, 0.3) : 0);
  const dropOnPlate = f < T.snatchGrab;

  const proj = (p: Pt, h: number) => project(cam, p, h);
  /** where a speech-bubble tail should point: the speaker's hand (knuckles) */
  const cuff = (p: Pose): Pt => {
    const a = (p.dir * Math.PI) / 180;
    const d = 170 * HAND_SCALE;
    return proj([p.x + Math.cos(a) * d, p.y + Math.sin(a) * d], p.h);
  };

  const handPoses = HANDS.map((_, i) => handPose(i, f));
  // a bubble's tail keeps pointing where its speaker WAS at the table (not after the hand has left the frame)
  const talkPoses = HANDS.map((b, i) => handPose(i, Math.min(Math.max(f, b.dig - 8), b.dig + 8)));
  /** a tail that POINTS at the speaker but never grows into a huge wedge: clamp its length */
  const tailFor = (bx: number, by: number, target: Pt, max = 440): Pt => {
    const dx = target[0] - bx;
    const dy = target[1] - by;
    const L = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, max / L);
    return [bx + dx * k, by + dy * k];
  };

  return (
    <AbsoluteFill style={{background: '#F2E3C4', overflow: 'hidden'}}>
      {music ? <Audio src={staticFile(music)} /> : null}

      {/* ---- the table (h 0): cloth, the plate, dig splashes, hand shadows */}
      <Layer cam={cam} h={0}>
        <Tablecloth />
        <FamilyPlate2D
          x={PLATE.x}
          y={PLATE.y}
          scale={PLATE.scale}
          rotate={PLATE.rotate}
          scoopsTaken={taken}
          dropShape="dot"
          drop={taken > 7 && dropOnPlate}
          dropWobble={dropWobble}
          frame={f}
        />
        {HANDS.map((b, i) => {
          const t = biteTarget(b);
          const a = ((handPoses[i].dir) * Math.PI) / 180;
          return <DigSplash key={b.id} x={t[0]} y={t[1]} at={b.dig} frame={f} dir={[Math.cos(a), Math.sin(a)]} seed={40 + i * 11} scale={1.1} />;
        })}
        <DigSplash x={DROP_WORLD[0]} y={DROP_WORLD[1]} at={T.snatchGrab} frame={f} dir={[1, -0.15]} seed={333} scale={0.9} />
        {/* shadows: the hand's silhouette on the table, pushed along the light by its height */}
        {hands.map(({key, pose: p, phone}) => (
          <div key={`sh-${key}`} style={{position: 'absolute', left: 0, top: 0, opacity: Math.max(0.1, 0.26 - p.h * 0.00045)}}>
            <Smear p={p}>
              {phone ? <PhoneProp x={p.x + phoneOffset(p)[0] + LIGHT[0] * p.h} y={p.y + phoneOffset(p)[1] + LIGHT[1] * p.h} angle={p.angle + 8} scale={HAND_SCALE} frame={f} silhouette={INK} /> : null}
              <FamilyHand x={p.x + LIGHT[0] * p.h} y={p.y + LIGHT[1] * p.h} angle={p.angle} scale={HAND_SCALE} silhouette={INK} />
            </Smear>
          </div>
        ))}
      </Layer>

      {/* ---- the hands, each at its own height above the table */}
      {hands.map(({key, pose: p, preset, garnish, phone}) => (
        <Layer key={key} cam={cam} h={p.h}>
          {key === 'snatch' && p.smear > 1.05 ? <SpeedLines x={p.x} y={p.y} dir={p.vel} len={260} spread={70} n={5} frame={f} seed={71} /> : null}
          {key === 'owner' && f2 < T.ownerStop - 2 ? <SpeedLines x={p.x} y={p.y} dir={p.vel} len={180} spread={50} n={3} frame={f} seed={91} /> : null}
          <Smear p={p}>
            {phone ? (
              <>
                <PhoneProp x={p.x + phoneOffset(p)[0]} y={p.y + phoneOffset(p)[1]} angle={p.angle + 8} scale={HAND_SCALE} frame={f} />
                <FamilyHand x={p.x + phoneOffset(p)[0]} y={p.y + phoneOffset(p)[1]} angle={p.angle + 8} scale={HAND_SCALE} {...FAMILY.teen} spoon={false} left frame={f2} />
              </>
            ) : null}
            <FamilyHand x={p.x} y={p.y} angle={p.angle} scale={HAND_SCALE} {...FAMILY[preset]} load={p.load} grip={p.grip} garnish={garnish} frame={f2} />
          </Smear>
        </Layer>
      ))}

      {/* ---- bubbles (screen space; tails follow the speaker's cuff) */}
      {HANDS.map((b, i) => (
        <SpeechBubble
          key={b.id}
          x={b.bubble.x}
          y={b.bubble.y}
          text={b.bubble.text}
          sub={b.bubble.sub}
          start={b.bubble.start}
          exit={b.bubble.exit}
          shape={b.bubble.shape}
          font={b.bubble.font}
          fontSize={b.bubble.fontSize}
          rotate={b.bubble.rotate}
          fill={b.bubble.fill}
          tail={tailFor(b.bubble.x, b.bubble.y, cuff(talkPoses[i]), b.bubble.tailMax ?? (b.bubble.shape === 'burst' ? 210 : 440))}
          seed={5 + i * 3}
          frame={f}
        />
      ))}
      <SpeechBubble x={LAYOUT.ownerThought.x} y={LAYOUT.ownerThought.y} text={COPY.ownerThought} start={T.ownerThought} exit={T.ownerThoughtOut} shape="cloud" fontSize={74} tail={tailFor(LAYOUT.ownerThought.x, LAYOUT.ownerThought.y, cuff(owner), 260)} seed={41} frame={f} />
      <SpeechBubble x={LAYOUT.ownerThought.x} y={LAYOUT.ownerThought.y} text={COPY.ownerDots} start={T.ownerDots} exit={T.ownerDotsOut} shape="cloud" fontSize={74} tail={tailFor(LAYOUT.ownerThought.x, LAYOUT.ownerThought.y, cuff(owner), 260)} seed={43} frame={f} />
      <SpeechBubble x={LAYOUT.ownerLine.x} y={LAYOUT.ownerLine.y} text={COPY.ownerLine} start={T.ownerLine} fontSize={66} tail={tailFor(LAYOUT.ownerLine.x, LAYOUT.ownerLine.y, cuff(owner), 210)} rotate={-3} seed={47} frame={f} />

      {/* ---- the counter */}
      <SpoonCounter x={LAYOUT.counter.x} y={LAYOUT.counter.y} rot={LAYOUT.counter.rot} frame={f} flips={counterFlips} label={COPY.counterLabel} exit={T.counterOut} />

      {/* ---- the moral */}
      <InkTitle x={LAYOUT.title.x} y={LAYOUT.title.y} text={COPY.title} start={T.title} stagger={T.titleStagger} fontSize={LAYOUT.title.fontSize} lineHeight={1.08} rotate={-2.5} highlight={{5: C.strawberry, 6: C.strawberry}} />

      {/* ---- end card (the last scene keeps playing under the paper sheet) */}
      <Sequence from={T.endCard} durationInFrames={ENDCARD_DURATION}>
        <EndCard2D headline={COPY.endHeadline} comment={COPY.endComment} grain={false} />
      </Sequence>

      <PaperGrain />
    </AbsoluteFill>
  );
};

/** the teen's phone hand sits beside his spoon hand (on his left), same arm direction */
const phoneOffset = (p: Pose): Pt => {
  const a = (p.dir * Math.PI) / 180;
  const n: Pt = [-Math.sin(a), Math.cos(a)];
  return [n[0] * -210 + Math.cos(a) * 120, n[1] * -210 + Math.sin(a) * 120];
};
