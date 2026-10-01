// End card (T.endCard → end): flat brand turquoise, the «خلّيها قشطة.» stamp stays on top (rendered by
// MishQashta above everything), product + teal logo lockup, the CTA stamp, how/where, the comment prompt.
import React from 'react';
import {COLORS, T} from '../spec';
import {CupToCard} from './CupToCard';
import {CommentPrompt, CtaInfo, CtaStamp} from './Cta';
import {Lockup} from './Lockup';

export const EndCard: React.FC<{frame: number}> = ({frame}) => {
  // (the live shot already starts pulling back at E.morph.from over MishQashta's turquoise base)
  if (frame < T.endCard) return null;
  return (
    <>
      <div style={{position: 'absolute', inset: 0, background: COLORS.turquoise}} />
      {/* the logo sits behind the travelling cup: its Q pops out from behind the dome */}
      <Lockup frame={frame} />
      <CupToCard frame={frame} />
      <CtaStamp frame={frame} />
      <CtaInfo frame={frame} />
      <CommentPrompt frame={frame} />
    </>
  );
};
