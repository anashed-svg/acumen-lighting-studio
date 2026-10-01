// Mixed Arabic + numbers: numbers with their units (41°, 85%, 19:19) are isolated LTR runs, so the
// degree/percent signs never flip to the wrong side inside RTL text.
import React from 'react';
import {ltrRuns} from '../timeline';

export const Mixed: React.FC<{text: string}> = ({text}) => (
  <>
    {ltrRuns(text).map((p, i) =>
      i % 2 ? (
        <span key={i} style={{direction: 'ltr', unicodeBidi: 'isolate'}}>
          {p}
        </span>
      ) : (
        <React.Fragment key={i}>{p}</React.Fragment>
      ),
    )}
  </>
);

// 'الإحساس 48°' -> {label: 'الإحساس', value: '48°'}
export const splitValue = (text: string) => {
  const parts = ltrRuns(text);
  return {label: parts[0].trim(), value: parts[1] ?? ''};
};
