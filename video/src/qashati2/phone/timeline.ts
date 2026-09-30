// Phone story — micro-timeline derived from the spec anchors (T). Everything here is an offset from
// a spec cue, so moving a cue in spec.ts moves the whole beat with it.
import {Easing, interpolate} from 'remotion';
import {T} from '../spec';

export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const [sWeather, sMaps, sBoss, sFamily] = T.screens;

export const P = {
  // weather -> maps: thumb swipes along the gesture bar, app cards slide.
  swipe: {touch: sMaps.start - 9, from: sMaps.start - 7, to: sMaps.start + 2},
  // maps -> boss: screen goes off, wakes on the 23:04 lock screen with the boss's message, tap, chat opens.
  screenOff: sMaps.start + 22, // 58
  wake: sBoss.start - 10, // 62
  lockNotif: sBoss.start - 9, // 63
  lockTap: sBoss.start - 4, // 68
  openChat: {from: sBoss.start - 3, to: sBoss.start + 3}, // 69..75
  // boss -> family: frozen on the boss's message, the clock runs 23:04 -> 23:31, family badge climbs,
  // tap back, the chat list flashes, tap the family group.
  familyBadge: {from: sBoss.stamp + 10, to: sFamily.start - 5}, // 90..103
  clockRoll: {from: sFamily.start - 17, to: sFamily.start - 11}, // 91..97
  backTap: sFamily.start - 9, // 99
  pop: {from: sFamily.start - 8, to: sFamily.start - 4}, // 100..104
  rowTap: sFamily.start - 4, // 104
  push: {from: sFamily.start - 3, to: sFamily.start + 2}, // 105..110
  // family chaos: messages pour in, the screen reddens and shakes, then everything stops dead.
  chaos: {from: sFamily.stamp + 2, to: T.act1End},
  // order banner + the two dots leaving the app icon
  banner: {in: T.notification, out: T.dropLand[1] - 6},
  dotLaunch: [T.dropLand[0] - 8, T.dropLand[1] - 8],
  flood: {from: T.flood, full: T.cupShot - 3},
};

export const screenIds = {weather: sWeather, maps: sMaps, boss: sBoss, family: sFamily};

// Battery drains through the day: 31% at 14:12 ... 12% when it all stops.
export const batteryAt = (f: number) => {
  if (f < sMaps.start - 2) return 31;
  if (f < P.wake) return 27;
  if (f < sFamily.start - 2) return 19;
  return Math.round(interpolate(f, [sFamily.start, T.act1End - 4], [14, 12], clamp));
};

export const easeOut = Easing.out(Easing.cubic);
export const easeIn = Easing.in(Easing.cubic);
export const easeInOut = Easing.inOut(Easing.cubic);

// Simple deterministic hash -> [0,1)
export const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
};
