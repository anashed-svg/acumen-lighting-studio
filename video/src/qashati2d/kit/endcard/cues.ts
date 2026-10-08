// End card timing — RELATIVE frames (0 = the frame the end card's <Sequence> starts). Pure data: the spots' sound
// scripts read it through esbuild (see kit/audio/sfx.py ts_eval) — move a cue here and the sound follows.
//
//   global frame of a cue = T.endCard + EC.<cue>
export const ENDCARD_DURATION = 105; // 3.5 s

export const EC = {
  /** the turquoise paper sheet starts sliding up over the last scene (paper swish) … */
  sheet: 0,
  /** … and is fully in (a soft paper "thup") */
  sheetIn: 8,
  /** optional headline: first word's impact = headline + 2, next words every 4 frames */
  headline: 4,
  /** the hero cup drops in and lands (squash) — a soft plop */
  cupLand: 14,
  /** logo reveal start (LogoReveal2D, on twos: Q stamp impact at +2, its dots land at +8 and +14) */
  logoStart: 12,
  /** the logo's two dots land — THE SONIC LOGO «تشك-تشك»: clack 1 on dot 1, clack 2 on dot 2 */
  logoDots: [20, 26] as const,
  sonicLogo: 20,
  /** "The Sweet Happiness" fades up */
  tagline: 38,
  /** CTA stamp «اطلبها من طلبات»: approach at cta − 2, IMPACT at cta (stamp thud) */
  cta: 46,
  /** «أو من تطبيق قشاطي الشام» and «ندّ الحمر · دبي» */
  sub: 54,
  location: 58,
  /** comment-prompt bubble pops (smear frame); its overshoot is +2 (put the pop sound there) */
  comment: 66,
  /** loop life: a glint on the cup, a light sweep on the CTA */
  glintCup: 76,
  glintCta: 84,
  /** the living logo's dots hop and land (a small dry «تشك-تشك» echo, gap = logoDots gap) */
  dotHops: [92, 98] as const,
  end: ENDCARD_DURATION,
};

/** Default copy (CTA truth: Talabat first; the brand app is only confirmed on Google Play). */
export const ENDCARD_COPY = {
  cta: 'اطلبها من طلبات',
  sub: 'أو من تطبيق قشاطي الشام',
  location: 'ندّ الحمر · دبي',
  tagline: 'The Sweet Happiness',
};
