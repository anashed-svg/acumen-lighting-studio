// The UI under the glass: which app is on screen, the native-feeling switches between them, the status
// bar per screen and the "show touches" thumb indicator. Everything freezes dead at T.act1End.
import React from 'react';
import {Easing, interpolate} from 'remotion';
import {T} from '../../spec';
import {batteryAt, clamp, easeInOut, frozen, P} from '../timeline';
import {FamilyChat} from './Chats';
import {FAM_CARD, LockScreen} from './LockScreen';
import {MapsScreen} from './Maps';
import {StatusBar} from './StatusBar';
import {WeatherScreen} from './Weather';

const [sW, sM, sB, sF] = T.screens;
const full: React.CSSProperties = {position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, overflow: 'hidden'};

// ---------------------------------------------------------------- touches
type TouchEv = {from: number; to: number; tap: number; x: (f: number) => number; y: (f: number) => number};
const touches: TouchEv[] = [
  {
    from: P.swipe.touch,
    to: P.swipe.to - 1,
    tap: P.swipe.touch + 1,
    x: (f) => interpolate(f, [P.swipe.touch + 1, P.swipe.to - 1], [250, 880], {...clamp, easing: easeInOut}),
    y: (f) => 1872 - 10 * Math.sin(interpolate(f, [P.swipe.touch + 1, P.swipe.to - 1], [0, Math.PI], clamp)),
  },
  {from: P.famTap - 3, to: P.famTap + 3, tap: P.famTap, x: () => 610, y: () => FAM_CARD.top + 130},
  {
    // drag up through the unread messages to the evidence photo
    from: P.famScroll.touch - 1,
    to: P.famScroll.to + 1,
    tap: P.famScroll.touch,
    x: (f) => 640 + 20 * interpolate(f, [P.famScroll.from, P.famScroll.to], [0, 1], clamp),
    y: (f) => interpolate(f, [P.famScroll.from, P.famScroll.to], [1560, 900], {...clamp, easing: (t) => 1 - Math.pow(1 - t, 2.6)}),
  },
];

const Touches: React.FC<{frame: number}> = ({frame}) => (
  <>
    {touches.map((t, i) => {
      if (frame < t.from || frame > t.to) return null;
      const appear = interpolate(frame, [t.from, t.from + 2, t.to - 1, t.to], [0, 1, 1, 0], clamp);
      const press = interpolate(frame, [t.tap - 1, t.tap, t.tap + 2], [1, 0.82, 1], clamp);
      const ring = interpolate(frame, [t.tap, t.tap + 4], [0, 1], clamp);
      const x = t.x(frame);
      const y = t.y(frame);
      return (
        <React.Fragment key={i}>
          {ring > 0 && ring < 1 ? (
            <div
              style={{
                position: 'absolute',
                left: x - 90,
                top: y - 90,
                width: 180,
                height: 180,
                borderRadius: 90,
                border: '4px solid rgba(255,255,255,0.7)',
                transform: `scale(${0.5 + ring})`,
                opacity: 1 - ring,
              }}
            />
          ) : null}
          <div
            style={{
              position: 'absolute',
              left: x - 52,
              top: y - 52,
              width: 104,
              height: 104,
              borderRadius: 52,
              background: 'rgba(200,200,205,0.55)',
              border: '3px solid rgba(255,255,255,0.75)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
              transform: `scale(${(0.6 + 0.4 * appear) * press})`,
              opacity: appear,
            }}
          />
        </React.Fragment>
      );
    })}
  </>
);

// ---------------------------------------------------------------- screens
export const Screens: React.FC<{frame: number}> = ({frame}) => {
  const f = frozen(frame);
  const layers: React.ReactNode[] = [];
  let status: React.ReactNode = null;

  if (f < P.swipe.to) {
    // 1) weather, 2) app-switch swipe to maps
    const sw = interpolate(f, [P.swipe.from, P.swipe.to], [0, 1], {...clamp, easing: Easing.bezier(0.3, 0.05, 0.25, 1)});
    const dip = Math.sin(Math.PI * sw);
    const sc = 1 - 0.1 * dip;
    const r = 70 * Math.min(1, dip * 3);
    if (sw > 0) layers.push(<div key="gap" style={{...full, background: '#000'}} />);
    layers.push(
      <div key="w" style={{...full, borderRadius: r, transform: `translateX(${sw * 1130}px) scale(${sc})`, boxShadow: sw > 0 ? '0 0 60px rgba(0,0,0,0.5)' : undefined}}>
        <WeatherScreen frame={f} />
      </div>,
    );
    if (sw > 0) {
      layers.push(
        <div key="m" style={{...full, borderRadius: r, transform: `translateX(${(sw - 1) * 1130}px) scale(${sc})`}}>
          <MapsScreen frame={f} />
        </div>,
      );
    }
    if (sw < 0.15) status = <StatusBar clock={sW.clock} battery={batteryAt(f)} dark={false} />;
  } else if (f < P.wake) {
    // 3) maps, then the screen switches off (time passes; the stamps float on the black glass)
    const off = interpolate(f, [P.screenOff, P.screenOff + 2], [1, 0], clamp);
    layers.push(<div key="gap" style={{...full, background: '#000'}} />);
    layers.push(
      <div key="m" style={{...full, opacity: off, transform: `scale(${1 - 0.015 * (1 - off)})`}}>
        <MapsScreen frame={f} />
      </div>,
    );
    if (f >= P.swipe.to + 1 && off > 0.5) status = <StatusBar clock={sM.clock} battery={batteryAt(f)} dark={false} network="5G" />;
  } else if (f < P.openFam.to) {
    // 4) 23:04 lock screen (boss), the family explodes, tap: the notification expands into the group chat
    layers.push(<div key="gap" style={{...full, background: '#000'}} />);
    const o = interpolate(f, [P.openFam.from, P.openFam.to], [0, 1], {...clamp, easing: Easing.bezier(0.2, 0.8, 0.2, 1)});
    layers.push(
      <div key="l" style={{...full, transform: `scale(${1 - 0.06 * o})`, filter: o > 0 ? `blur(${o * 14}px) brightness(${1 - 0.5 * o})` : undefined}}>
        <LockScreen frame={f} />
      </div>,
    );
    if (o > 0) {
      const l = FAM_CARD.left * (1 - o);
      const t = FAM_CARD.top * (1 - o);
      const w = FAM_CARD.width + (1080 - FAM_CARD.width) * o;
      const h = FAM_CARD.height + (1920 - FAM_CARD.height) * o;
      layers.push(
        <div key="fc" style={{position: 'absolute', left: l, top: t, width: w, height: h, borderRadius: 52 * (1 - o), overflow: 'hidden', opacity: Math.min(1, o * 3)}}>
          <div style={{...full, transform: `translate(${-l}px, ${-t}px)`}}>
            <FamilyChat frame={f} />
          </div>
        </div>,
      );
    }
    if (f >= P.wake + 1) status = <StatusBar clock={o < 0.5 ? sB.clock : sF.clock} battery={batteryAt(f)} dark shadow hideClock={o < 0.5} />;
  } else {
    // 5) family chaos, then everything stops dead at act1End
    layers.push(
      <div key="fam" style={full}>
        <FamilyChat frame={f} />
      </div>,
    );
    status = <StatusBar clock={sF.clock} battery={batteryAt(f)} dark />;
  }

  // once the banner has gone, the UI goes a little soft so the glass (stamps + cream) is the subject
  const focus = interpolate(frame, [P.banner.out + 2, P.banner.out + 12], [0, 1], {...clamp, easing: easeInOut});
  return (
    <div style={full}>
      <div style={{...full, filter: focus > 0 ? `blur(${(focus * 3.5).toFixed(2)}px)` : undefined}}>
        {layers}
        {status}
      </div>
      <Touches frame={f} />
    </div>
  );
};
