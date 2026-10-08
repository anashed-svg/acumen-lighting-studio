// <Ink> — a variable-weight brush stroke (see geom.brush) rendered as a filled path, memoised on its inputs.
import React, {useMemo} from 'react';
import {BrushOpts, brush, Pt} from '../geom';
import {INK} from '../palette';

export const Ink: React.FC<{
  pts: Pt[];
  w: number;
  closed?: boolean;
  color?: string;
  opacity?: number;
  o?: Partial<BrushOpts>;
  transform?: string;
}> = ({pts, w, closed = false, color = INK, opacity, o, transform}) => {
  const key = JSON.stringify([pts, w, closed, o]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const d = useMemo(() => brush(pts, {w, closed, ...o}), [key]);
  return <path d={d} fill={color} opacity={opacity} transform={transform} />;
};

/** Memo helper for components that build many brush paths at once. */
export const useBrushes = <T,>(build: () => T, deps: unknown[]): T =>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(build, [JSON.stringify(deps)]);
