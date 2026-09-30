// The UI under the glass: which app is on screen, the native-feeling switches between them,
// status bar per screen and the "show touches" thumb indicator.
import React from 'react';
import {Easing, interpolate} from 'remotion';
import {T} from '../../spec';
import {batteryAt, clamp, easeInOut, P} from '../timeline';
import {BossChat, ChatList, FamilyChat} from './Chats';
import {LOCK_CARD, LockScreen} from './LockScreen';
import {MapsScreen} from './Maps';
import {OrderBanner} from './OrderBanner';
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
  {from: P.lockTap - 3, to: P.lockTap + 3, tap: P.lockTap, x: () => 600, y: () => LOCK_CARD.top + 120},
  {from: P.backTap - 3, to: P.backTap + 2, tap: P.backTap, x: () => 1000, y: () => 206},
  {from: P.rowTap - 2, to: P.rowTap + 2, tap: P.rowTap, x: () => 640, y: () => 790},
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

// After the dead stop the screen dims; every stamp that turns «قشطة» lifts the mood a little.
const dimAt = (f: number) =>
  interpolate(f, [T.act1End, T.act1End + 3], [0, 0.34], clamp) - T.erase.reduce((a, e) => a + interpolate(f, [e + 5, e + 9], [0, 0.05], clamp), 0);

// ---------------------------------------------------------------- screens
export const Screens: React.FC<{frame: number}> = ({frame}) => {
  const f = frame;
  const layers: React.ReactNode[] = [];
  let status: React.ReactNode = null;

  // 1) weather, 2) app-switch swipe to maps
  const sw = interpolate(f, [P.swipe.from, P.swipe.to], [0, 1], {...clamp, easing: Easing.bezier(0.3, 0.05, 0.25, 1)});
  if (f < P.swipe.to) {
    const dip = Math.sin(Math.PI * sw);
    const sc = 1 - 0.1 * dip;
    const r = 70 * Math.min(1, dip * 3);
    layers.push(
      <div key="w" style={{...full, borderRadius: r, transform: `translateX(${sw * 1130}px) scale(${sc})`, boxShadow: sw > 0 ? '0 0 60px rgba(0,0,0,0.5)' : undefined}}>
        <WeatherScreen frame={f} />
      </div>,
    );
    if (sw > 0) {
      layers.unshift(<div key="gap" style={{...full, background: '#000'}} />);
      layers.push(
        <div key="m" style={{...full, borderRadius: r, transform: `translateX(${(sw - 1) * 1130}px) scale(${sc})`}}>
          <MapsScreen frame={f} />
        </div>,
      );
    }
    if (sw < 0.15) status = <StatusBar clock={sW.clock} battery={batteryAt(f)} dark={false} />;
  } else if (f < P.wake) {
    // 3) maps, then the screen switches off (time passes)
    const off = interpolate(f, [P.screenOff, P.screenOff + 2], [1, 0], clamp);
    layers.push(<div key="gap" style={{...full, background: '#000'}} />);
    layers.push(
      <div key="m" style={{...full, opacity: off, transform: `scale(${1 - 0.015 * (1 - off)})`}}>
        <MapsScreen frame={f} />
      </div>,
    );
    if (f >= P.swipe.to + 1 && off > 0.5) status = <StatusBar clock={sM.clock} battery={batteryAt(f)} dark={false} network="5G" />;
  } else if (f < P.openChat.to) {
    // 4) lock screen 23:04, tap the message, it opens the chat (card expands)
    layers.push(<div key="gap" style={{...full, background: '#000'}} />);
    const o = interpolate(f, [P.openChat.from, P.openChat.to], [0, 1], {...clamp, easing: Easing.bezier(0.2, 0.8, 0.2, 1)});
    layers.push(
      <div key="l" style={{...full, transform: `scale(${1 - 0.06 * o})`, filter: o > 0 ? `blur(${o * 14}px) brightness(${1 - 0.5 * o})` : undefined}}>
        <LockScreen frame={f} />
      </div>,
    );
    if (o > 0) {
      const l = LOCK_CARD.left * (1 - o);
      const t = LOCK_CARD.top * (1 - o);
      const w = LOCK_CARD.width + (1080 - LOCK_CARD.width) * o;
      const h = LOCK_CARD.height + (1920 - LOCK_CARD.height) * o;
      layers.push(
        <div key="bc" style={{position: 'absolute', left: l, top: t, width: w, height: h, borderRadius: 50 * (1 - o), overflow: 'hidden', opacity: Math.min(1, o * 3)}}>
          <div style={{...full, transform: `translate(${-l * 0}px, ${-(1 - o) * 700}px)`}}>
            <BossChat frame={f} />
          </div>
        </div>,
      );
    }
    if (f >= P.wake + 1) status = <StatusBar clock={sB.clock} battery={batteryAt(f)} dark shadow />;
  } else if (f < P.push.to) {
    // 5) boss chat (frozen, clock runs on), 6) back to the list, 7) into the family group
    const pop = interpolate(f, [P.pop.from, P.pop.to], [0, 1], {...clamp, easing: Easing.bezier(0.25, 0.8, 0.25, 1)});
    const push = interpolate(f, [P.push.from, P.push.to], [0, 1], {...clamp, easing: Easing.bezier(0.25, 0.8, 0.25, 1)});
    const roll = interpolate(f, [P.clockRoll.from, P.clockRoll.to], [0, 1], clamp);
    if (pop > 0) {
      layers.push(
        <div key="list" style={{...full, transform: `translateX(${(1 - pop) * 330 + push * 330}px)`}}>
          <ChatList frame={f} pressed={interpolate(f, [P.rowTap - 1, P.rowTap, P.push.to], [0, 1, 0.6], clamp)} />
          <div style={{...full, background: '#000', opacity: 0.45 * (1 - pop) + 0.45 * push}} />
        </div>,
      );
    }
    if (pop < 1) {
      layers.push(
        <div key="boss" style={{...full, transform: `translateX(${-pop * 1080}px)`, boxShadow: pop > 0 ? '10px 0 40px rgba(0,0,0,0.6)' : undefined}}>
          <BossChat frame={f} />
        </div>,
      );
    }
    if (push > 0) {
      layers.push(
        <div key="fam" style={{...full, transform: `translateX(${-(1 - push) * 1080}px)`, boxShadow: '10px 0 40px rgba(0,0,0,0.6)'}}>
          <FamilyChat frame={f} />
        </div>,
      );
    }
    status = <StatusBar clock={sB.clock} clockTo={sF.clock} roll={roll} battery={batteryAt(f)} dark />;
  } else {
    // 8) family chaos, then everything stops dead at act1End
    layers.push(
      <div key="fam" style={full}>
        <FamilyChat frame={f} />
      </div>,
    );
    status = <StatusBar clock={sF.clock} battery={batteryAt(f)} dark />;
  }

  const focus = interpolate(f, [P.banner.out + 2, P.banner.out + 12], [0, 1], {...clamp, easing: easeInOut});
  return (
    <div style={full}>
      <div style={{...full, filter: focus > 0 ? `blur(${focus * 5}px)` : undefined}}>
        {layers}
        {status}
      </div>
      {f >= T.act1End ? <div style={{...full, background: '#000', opacity: dimAt(f)}} /> : null}
      <OrderBanner frame={f} />
      <Touches frame={f} />
    </div>
  );
};
