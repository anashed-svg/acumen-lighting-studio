// Phone story — micro-timeline derived from the spec anchors (T). Everything here is an offset from
// a spec cue, so moving a cue in spec.ts moves the whole beat with it.
import {Easing, interpolate} from 'remotion';
import {T} from '../spec';

export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const [sWeather, sMaps, sBoss, sFamily] = T.screens;

export const P = {
  // weather -> maps: the thumb swipes along the gesture bar, the app cards slide.
  swipe: {touch: sMaps.start - 9, from: sMaps.start - 7, to: sMaps.start + 2}, // 31, 33..42
  // maps -> 23:04 lock screen: the screen goes off (stamps float on black glass), wakes on the boss's message.
  screenOff: sBoss.start - 10, // 64
  wake: sBoss.start - 6, // 68
  bossNotif: sBoss.start - 5, // 69: notification slides in
  bossPunch: {from: sBoss.start - 1, to: sBoss.start + 5}, // 73..79: editorial punch-in on the message
  // the family group explodes on the lock screen while the clock runs 23:04 -> 23:31; tap opens the group
  famNotif: sFamily.start - 14, // 90
  clockRoll: {from: sFamily.start - 12, to: sFamily.start - 6}, // 92..98
  famTap: sFamily.start - 5, // 99
  openFam: {from: sFamily.start - 4, to: sFamily.start + 2}, // 100..106
  // family: opens on the first unread («مين أكل…»), the thumb scrolls down to «الدليل» photo, chaos builds.
  famScroll: {touch: sFamily.stamp + 4, from: sFamily.stamp + 5, to: sFamily.stamp + 13}, // 114, 115..123
  chaos: {from: sFamily.stamp + 2, to: T.act1End},
  // the turn: order banner, the icon's two dots leap onto the glass
  banner: {in: T.notification - 1, out: T.dropLand[1] + 2}, // lands on T.notification; leaves after dot 2
  dotLaunch: [T.dropLand[0] - 6, T.dropLand[1] - 6] as [number, number],
  // the twist as the hero shot
  push: {from: T.dropLand[0], to: T.erase[0] - 2}, // 166..176 push in on stamp 0
  smear: {from: T.erase[0], to: T.erase[0] + 18}, // 178..196 «مش» smears off with the cream
  whip: {from: T.erase[0] + 18, to: T.erase[0] + 26}, // 196..204 whip back out
  holdBounce: [T.holdQashta, T.holdQashta + 15] as [number, number], // synced bounces on the beat (120 BPM)
  // front off the bottom at 277, solid cream from T.cupShot - 2: only 278–280 are all-cream (with moving folds),
  // CreamReveal already shows the cup at the top on its 2nd frame (281)
  flood: {from: T.flood, full: T.cupShot - 2},
};

export const screenIds = {weather: sWeather, maps: sMaps, boss: sBoss, family: sFamily};

// Battery drains through the day: 31% at 14:12 ... 12% when it all stops.
export const batteryAt = (f: number) => {
  if (f < sMaps.start - 2) return 31;
  if (f < P.wake) return 27;
  if (f < P.clockRoll.to) return 19;
  return Math.round(interpolate(f, [P.clockRoll.to, T.act1End - 4], [14, 12], clamp));
};

// Everything in the UI and on the glass freezes dead at act1End (true stillness until the banner).
export const frozen = (f: number) => Math.min(f, T.act1End);

export const easeOut = Easing.out(Easing.cubic);
export const easeIn = Easing.in(Easing.cubic);
export const easeInOut = Easing.inOut(Easing.cubic);

// Simple deterministic hash -> [0,1)
export const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
};

// Wrap numbers-with-units (41°, 85%, 19:19) so their signs never flip inside RTL text.
export const ltrRuns = (s: string) => s.split(/(\d[\d:.,]*[°%]?)/);
