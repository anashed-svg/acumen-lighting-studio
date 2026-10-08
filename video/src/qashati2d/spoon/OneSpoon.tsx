// «ملعقة وحدة بس» — the scene. Read spec.ts first (story, timeline, copy, cue list).
// Layers (back → front): table + plate + the last drop (h 0) · hand shadows on the table · hands (each at its own
// height: dolly parallax) · spotlight (screen) · bubbles / counter / note + moral (screen) · end card · paper grain LAST.
import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {C, ENDCARD_DURATION, FamilyPlate2D, INK, InkTitle, jiggle, onTwos, PaperGrain, Pt, SpeechBubble} from '../kit/lib';
import {LastDrop, MoralNote, Spotlight} from './art/Ending';
import {EndCardSpoon} from './art/EndCardSpoon';
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
/** the last dollop's radius (world px) — big enough to read as qashta at phone size */
const DROP_R = 62;
/** the kid's hands are smaller (both his turn and the snatch) */
const handScale = (preset: string) => HAND_SCALE * (preset === 'kid' ? 0.86 : 1);

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

type HandSpec = {key: string; pose: Pose; preset: keyof typeof FAMILY; garnish: 'strawberry' | 'mango' | 'kiwi' | 'drop' | 'none'; heap: number; seed: number; phone?: boolean};

/** a short tail stub from a bubble towards its speaker: it leaves the bubble's edge and points, it never becomes a
 *  long wedge across the frame (and so never crosses another bubble) */
const tailStub = (bx: number, by: number, target: Pt, hw: number, hh: number, len = 105): Pt => {
  const dx = target[0] - bx;
  const dy = target[1] - by;
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const edge = Math.min(Math.abs(hw / (ux || 1e-6)), Math.abs(hh / (uy || 1e-6)));
  const d = Math.min(L, edge + len);
  return [bx + ux * d, by + uy * d];
};
/** rough bubble half-size from its copy (the bubble measures itself; this only aims the tail) */
const bubbleHalf = (text: string, fontSize: number, latin: boolean): [number, number] => {
  const lines = text.split('\n');
  const chars = Math.max(...lines.map((l) => [...l].length));
  return [(chars * fontSize * (latin ? 0.56 : 0.46)) / 2 + fontSize * 0.75, (lines.length * fontSize * 1.32) / 2 + fontSize * 0.5];
};

export const OneSpoon: React.FC<{music: string | null}> = ({music}) => {
  const f = useCurrentFrame();
  const f2 = onTwos(f);
  const cam = camAt(f, T.snatchGrab, T.ownerStop);
  const taken = plateTaken(f);

  // who is on stage
  const hands: HandSpec[] = [];
  HANDS.forEach((b, i) => {
    const p = handPose(i, f);
    if (p.visible) hands.push({key: b.id, pose: p, preset: b.id, garnish: b.garnish, heap: b.heap, seed: 11 + i * 7, phone: b.id === 'teen'});
  });
  const owner = ownerPose(f);
  if (owner.visible) hands.push({key: 'owner', pose: owner, preset: 'owner', garnish: 'none', heap: 0, seed: 1});
  const snatch = snatchPose(f);
  if (snatch.visible) hands.push({key: 'snatch', pose: snatch, preset: 'kid', garnish: 'drop', heap: 0, seed: 1});

  // the last drop: it appears with the final (centre) bite, shivers alone in the silence, then the kid takes it
  const dropShow = taken > 7 ? Math.min(1, (taken - 7) * 1.6) : 0;
  const dropWobble =
    jiggle(f2, T.dropWobbles[0], 1, 0.9, 0.18) + jiggle(f2, T.dropWobbles[1], 0.7, 0.9, 0.2) + (f2 >= T.ownerStop && f2 < T.ownerStop + 10 ? jiggle(f2, T.ownerStop, 0.6, 1.1, 0.3) : 0);
  const dropGone = f >= T.snatchGrab;
  const gk = f2 - T.dropGlint;
  const dropGlint = gk >= 0 && gk < 10 ? [0.5, 1, 0.8, 0.45, 0.2][gk / 2] : 0;

  const proj = (p: Pt, h: number) => project(cam, p, h);
  /** where a speech-bubble tail should point: the speaker's knuckles */
  const knuckles = (p: Pose): Pt => {
    const a = (p.dir * Math.PI) / 180;
    const d = 300 * HAND_SCALE;
    return proj([p.x + Math.cos(a) * d, p.y + Math.sin(a) * d], p.h);
  };
  // a bubble's tail keeps pointing where its speaker WAS at the table (not after the hand has left the frame)
  const talkPoses = HANDS.map((b, i) => handPose(i, Math.min(Math.max(f, b.dig - 8), b.dig + 8)));
  const handPoses = HANDS.map((_, i) => handPose(i, f));

  // spotlight: closes in on the drop (and the owner's clean spoon) in the silence, blows open on the snatch
  const dropScreen = proj(DROP_WORLD, 0);
  const ownerScreen = proj([owner.x, owner.y], owner.h);
  const spotC: Pt = [dropScreen[0] * 0.72 + ownerScreen[0] * 0.28, dropScreen[1] * 0.72 + ownerScreen[1] * 0.28];
  let spotR = 1400;
  let spotA = 0;
  if (f2 >= T.spotIn && f2 < T.snatchGrab) {
    const t = Math.min(1, (f2 - T.spotIn) / (T.spotSet - T.spotIn));
    const e = 1 - (1 - t) ** 3;
    spotR = 1150 - (1150 - 300) * e;
    spotA = Math.min(1, t * 2.2);
  } else if (f2 >= T.snatchGrab && f2 < T.snatchGrab + 6) {
    const k = (f2 - T.snatchGrab) / 2; // 0, 1, 2 → blown open in three drawings
    spotR = [520, 900, 1400][k];
    spotA = [0.85, 0.5, 0.2][k];
  }

  const ownerLineXY = LAYOUT.ownerLine;
  const [olw, olh] = bubbleHalf(COPY.ownerLine, ownerLineXY.fontSize, false);

  return (
    <AbsoluteFill style={{background: '#F2E3C4', overflow: 'hidden'}}>
      {music ? <Audio src={staticFile(music)} /> : null}

      {/* ---- the table (h 0): cloth, the plate, the last drop, dig splashes, hand shadows */}
      <Layer cam={cam} h={0}>
        <Tablecloth />
        <FamilyPlate2D x={PLATE.x} y={PLATE.y} scale={PLATE.scale} rotate={PLATE.rotate} scoopsTaken={taken} drop={false} frame={f} />
        <LastDrop x={DROP_WORLD[0]} y={DROP_WORLD[1]} r={DROP_R} frame={f} wobble={dropWobble} gone={dropGone} glint={dropGlint} show={dropShow} />
        {HANDS.map((b, i) => {
          const t = biteTarget(b);
          const a = (handPoses[i].dir * Math.PI) / 180;
          return <DigSplash key={b.id} x={t[0]} y={t[1]} at={b.dig} frame={f} dir={[Math.cos(a), Math.sin(a)]} seed={40 + i * 11} scale={1.1} />;
        })}
        <DigSplash x={DROP_WORLD[0]} y={DROP_WORLD[1]} at={T.snatchGrab} frame={f} dir={[-0.83, -0.56]} seed={333} scale={0.9} />
        {/* shadows: the hand's silhouette on the table, pushed along the light by its height */}
        {hands.map(({key, pose: p, phone, heap, seed, preset}) => (
          <div key={`sh-${key}`} style={{position: 'absolute', left: 0, top: 0, opacity: Math.max(0.1, 0.26 - p.h * 0.00045)}}>
            <Smear p={p}>
              {phone ? <PhoneProp x={p.x + phoneOffset(p)[0] + LIGHT[0] * p.h} y={p.y + phoneOffset(p)[1] + LIGHT[1] * p.h} angle={p.angle + 8} scale={HAND_SCALE} frame={f} silhouette={INK} /> : null}
              <FamilyHand x={p.x + LIGHT[0] * p.h} y={p.y + LIGHT[1] * p.h} angle={p.angle} scale={handScale(preset)} silhouette={INK} heap={heap} heapSeed={seed} load={p.load} />
            </Smear>
          </div>
        ))}
      </Layer>

      {/* ---- the hands, each at its own height above the table */}
      {hands.map(({key, pose: p, preset, garnish, phone, heap, seed}) => (
        <Layer key={key} cam={cam} h={p.h}>
          {key === 'snatch' && p.smear > 1.05 ? <SpeedLines x={p.x} y={p.y} dir={p.vel} len={300} spread={80} n={5} frame={f} seed={71} /> : null}
          {key === 'owner' && f2 < T.ownerStop - 2 ? <SpeedLines x={p.x} y={p.y} dir={p.vel} len={180} spread={50} n={3} frame={f} seed={91} /> : null}
          <Smear p={p}>
            {phone ? (
              <>
                <PhoneProp x={p.x + phoneOffset(p)[0]} y={p.y + phoneOffset(p)[1]} angle={p.angle + 8} scale={HAND_SCALE} frame={f} />
                <FamilyHand x={p.x + phoneOffset(p)[0]} y={p.y + phoneOffset(p)[1]} angle={p.angle + 8} scale={HAND_SCALE} {...FAMILY.teen} spoon={false} left frame={f2} />
              </>
            ) : null}
            <FamilyHand
              x={p.x}
              y={p.y}
              angle={p.angle}
              scale={handScale(preset)}
              {...FAMILY[preset]}
              load={p.load}
              grip={p.grip}
              garnish={garnish}
              heap={heap}
              heapSeed={seed}
              heapWobble={p.heapWobble ?? 0}
              frame={f2}
            />
          </Smear>
        </Layer>
      ))}

      {/* ---- the spotlight (the room goes dark around the last drop) */}
      <Spotlight cx={spotC[0]} cy={spotC[1]} r={spotR} amount={spotA} />

      {/* ---- bubbles (screen space; tail stubs point at the speaker) */}
      {HANDS.map((b, i) => {
        const latin = b.bubble.font === 'latin';
        const fs = b.bubble.fontSize ?? 56;
        const [hw, hh] = bubbleHalf(b.bubble.text, fs, latin);
        return (
          <SpeechBubble
            key={b.id}
            x={b.bubble.x}
            y={b.bubble.y}
            text={b.bubble.text}
            start={b.bubble.start}
            exit={b.bubble.exit}
            shape={b.bubble.shape}
            font={b.bubble.font}
            fontSize={fs}
            rotate={b.bubble.rotate}
            fill={b.bubble.fill}
            tail={tailStub(b.bubble.x, b.bubble.y, knuckles(talkPoses[i]), hw, hh, b.bubble.shape === 'burst' ? 80 : 105)}
            seed={5 + i * 3}
            frame={f}
          />
        );
      })}
      <SpeechBubble x={LAYOUT.ownerThought.x} y={LAYOUT.ownerThought.y} text={COPY.ownerThought} start={T.ownerThought} exit={T.ownerStop} shape="cloud" fontSize={76} tail={tailStub(LAYOUT.ownerThought.x, LAYOUT.ownerThought.y, knuckles(owner), 90, 80, 150)} seed={41} frame={f} />
      <SpeechBubble x={LAYOUT.ownerDots.x} y={LAYOUT.ownerDots.y} text={COPY.ownerDots} start={T.ownerDots} exit={T.ownerDotsOut} shape="cloud" fontSize={80} tail={tailStub(LAYOUT.ownerDots.x, LAYOUT.ownerDots.y, knuckles(owner), 90, 80, 160)} seed={43} frame={f} />
      <SpeechBubble
        x={ownerLineXY.x}
        y={ownerLineXY.y}
        text={COPY.ownerLine}
        start={T.ownerLine}
        exit={T.ownerLineOut}
        fontSize={ownerLineXY.fontSize}
        tail={tailStub(ownerLineXY.x, ownerLineXY.y, knuckles(owner), olw, olh, 110)}
        rotate={-3}
        seed={47}
        frame={f}
      />

      {/* ---- the counter */}
      <SpoonCounter x={LAYOUT.counter.x} y={LAYOUT.counter.y} rot={LAYOUT.counter.rot} frame={f} flips={counterFlips} label={COPY.counterLabel} exit={T.counterOut} />

      {/* ---- the moral: a note slapped on the table, the words pressed onto it */}
      <MoralNote x={LAYOUT.note.x} y={LAYOUT.note.y} w={LAYOUT.note.w} h={LAYOUT.note.h} rot={LAYOUT.note.rot} at={T.note} frame={f} />
      <InkTitle
        x={LAYOUT.title.x}
        y={LAYOUT.title.y}
        text={COPY.title}
        start={T.title}
        stagger={T.titleStagger}
        fontSize={LAYOUT.title.fontSize}
        lineHeight={1.06}
        rotate={LAYOUT.note.rot}
        highlight={{5: C.strawberry, 6: C.strawberry}}
        plate={C.turquoiseLight}
        plateOffset={[5, 4]}
        specks={false}
      />

      {/* ---- end card (the kit's EndCard2D, forked only to press its Arabic headline without stray ink specks) */}
      <Sequence from={T.endCard} durationInFrames={ENDCARD_DURATION}>
        <EndCardSpoon headline={COPY.endHeadline} comment={COPY.endComment} grain={false} />
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
