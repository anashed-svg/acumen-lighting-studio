// QafLab — a development sheet for the spot's own drawings (the flick hand poses, the spoon's faces/poses).
// Not part of the spot; frame = page: 0 hand poses · 2 spoon faces · 4 spoon poses (melt, squash, heap).
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {C, PaperGrain} from '../../kit/lib';
import {FlickHandArt, FlickPose} from './FlickHand';
import {SpoonBuddy, SpoonFace} from './SpoonBuddy';

const POSES: FlickPose[] = ['cocked', 'strain', 'smear', 'flicked', 'relaxed'];
const FACES: [string, SpoonFace][] = [
  ['hopeful', {eye: 'open', look: [0.6, -0.6], brow: {raise: 0.6, tilt: 0.3}, mouth: 'smile'}],
  ['worried', {eye: 'open', look: [0.7, -0.7], brow: {raise: 0.4, tilt: 1}, mouth: 'wavy'}],
  ['deadpan', {eye: 'half', look: [0, 0.1], brow: {raise: -0.3, tilt: 0}, mouth: 'flat'}],
  ['take', {eye: 'big', look: [0, -0.2], brow: {raise: 1.2, tilt: 0.6}, mouth: 'o'}],
  ['hot', {eye: 'squeeze', brow: {raise: 0.3, tilt: 1}, mouth: 'pant', flush: 1}],
  ['melt', {eye: 'half', look: [-0.3, 0.6], brow: {raise: 0, tilt: 1.2}, mouth: 'wavy', flush: 0.6}],
  ['joy', {eye: 'spark', look: [0, -0.3], brow: {raise: 1, tilt: -0.2}, mouth: 'grin', blush: 0.8}],
  ['bliss', {eye: 'closed', brow: {raise: 0.6}, mouth: 'bliss', blush: 1}],
];

export const QafLab: React.FC = () => {
  const f = useCurrentFrame();
  const page = Math.floor(f / 2);
  return (
    <AbsoluteFill style={{background: C.turquoise}}>
      <svg width={1080} height={1920} style={{position: 'absolute', overflow: 'visible'}}>
        {page === 0
          ? POSES.map((p, i) => (
              <g key={p} transform={`translate(${i % 2 ? 760 : 330} ${300 + Math.floor(i / 2) * 560}) rotate(55) scale(1.05)`}>
                <FlickHandArt pose={p} rot={55} frame={f} squeeze={p === 'strain' ? 1 : 0} />
              </g>
            ))
          : null}
        {page === 1
          ? FACES.map(([n, face], i) => (
              <g key={n} transform={`translate(${170 + (i % 4) * 250} ${820 + Math.floor(i / 4) * 900}) scale(0.85)`}>
                <SpoonBuddy frame={f} face={face} pose={{melt: n === 'melt' ? 0.7 : 0}} tint={n === 'hot' || n === 'melt' ? C.chili : C.turquoise} />
              </g>
            ))
          : null}
        {page === 2
          ? [
              {pose: {bend: 0.3}, load: 0},
              {pose: {squash: 0.25}, load: 0},
              {pose: {squash: -0.15, bend: -0.2}, load: 0},
              {pose: {melt: 1, meltSide: -1 as const}, load: 0},
              {pose: {bend: 0.15}, load: 1},
              {pose: {}, load: 0.6},
            ].map((s, i) => (
              <g key={i} transform={`translate(${200 + (i % 3) * 340} ${860 + Math.floor(i / 3) * 900}) scale(0.95)`}>
                <SpoonBuddy frame={f} face={i >= 4 ? FACES[7][1] : FACES[i][1]} pose={s.pose} load={s.load} />
              </g>
            ))
          : null}
      </svg>
      <PaperGrain />
    </AbsoluteFill>
  );
};
