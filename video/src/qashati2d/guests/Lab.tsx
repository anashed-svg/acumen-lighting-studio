// GuestsLab — development sheet for the spot's own drawings (not part of the spot). frame = page.
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {C, PaperGrain} from '../kit/lib';
import {Guest, GuestId} from './art/Guest';

const IDS: GuestId[] = ['khala', 'amo', 'jiddo', 'teta', 'walad', 'bint'];

export const GuestsLab: React.FC = () => {
  const f = useCurrentFrame();
  const page = Math.floor(f / 2);
  return (
    <AbsoluteFill style={{background: C.paper}}>
      <svg width={1080} height={1920} style={{position: 'absolute', overflow: 'visible'}}>
        {page === 0
          ? IDS.map((id, i) => (
              <Guest key={id} id={id} x={270 + (i % 2) * 540} y={300 + Math.floor(i / 2) * 620} scale={0.95} arm={i % 2 ? 'none' : 'wave'} side={1} wave={0.5} frame={f} />
            ))
          : null}
        {page === 1
          ? IDS.map((id, i) => (
              <Guest key={id} id={id} x={270 + (i % 2) * 540} y={300 + Math.floor(i / 2) * 620} scale={0.95} eyes={(['wide', 'hearts', 'smile', 'closed', 'wide', 'hearts'] as const)[i]} mouth={(['o', 'yum', 'smile', 'chew', 'grin', 'grin'] as const)[i]} arm={i < 4 ? 'cup' : 'spoon'} side={i % 2 ? -1 : 1} wired={i === 0 || i === 4 ? 1 : 0} turn={i === 2 ? 0.8 : i === 3 ? -0.8 : 0} frame={f} />
            ))
          : null}
      </svg>
      <PaperGrain />
    </AbsoluteFill>
  );
};
