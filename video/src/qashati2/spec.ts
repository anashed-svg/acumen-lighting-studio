// «مش قشطة» — Qashati Alsham spot #2. Single source of truth for timing, copy and colours.
// Every component and the sound script read from here (the sound script mirrors CUES in seconds).
// 30 fps, 1080x1920, 17 s. See SPEC.md for the creative intent.

export const FPS = 30;
export const W = 1080;
export const H = 1920;
export const DURATION = 510; // 17.0 s

export const COLORS = {
  turquoise: '#01E8D5', // logo
  turquoiseDeep: '#00B8A9',
  teal: '#053F3B',
  tealDark: '#032B28',
  cream: '#FFF7E8', // qashta
  stampRed: '#E5303A',
  honey: '#F4AE22',
  ink: '#0E0F12', // dark-mode UI background
};

// Frame timeline (v2 — after the 4-lens review panel, see out/qashati2/review-panel/panel.json).
export const T = {
  // Act 1 — "مش قشطة": four everyday Dubai screens, accelerating (40/34/30/26 frames), each gets a red stamp.
  // Stamp 0 is the hook: already mid-slam on frame 0 (thumbnail), lands at frame 2, much bigger than the rest.
  screens: [
    {id: 'weather', start: 0, stamp: 2, clock: '14:12'},
    {id: 'maps', start: 40, stamp: 48, clock: '18:07'},
    {id: 'boss', start: 74, stamp: 82, clock: '23:04'},
    {id: 'family', start: 104, stamp: 110, clock: '23:31'},
  ],
  burst: [128, 131, 134, 137, 140], // machine-gun pile-up of 5 smaller stamps (stamp indices 4..8)
  act1End: 144, // 4.8 s — chaos stops dead; frozen, dimmed, TRUE silence until the banner
  notification: 158, // 5.27 s — order-arrived banner
  cymbal: 160, // brass «تشك-تشك» sonic logo
  dropLand: [166, 172], // the icon's two dots land on the glass
  // Act 2 — the twist, staged as THE hero shot: push in on stamp 0 (166–176), its «مش» smears and slides
  // down with the cream (erase[0] → +18 f), whip back out (196–204), then domino the rest, then HOLD.
  erase: [178, 206, 211, 216, 221, 224, 227, 230, 233], // per stamp index: 0..3 main, 4..8 burst
  holdQashta: 236, // all stamps turquoise «قشطة» — hold with a synced bounce until the flood
  flood: 262, // 8.73 s — cream floods the screen
  // Act 3 — product.
  cupShot: 280, // 9.33 s — 3D hero shot, 120 frames (4.0 s)
  cupDrops: [304, 313], // drops land on the dome (local 0.8 / 1.1 s) and slump/merge into it
  title: 322, // «خلّيها قشطة.» slams as a big stamp (callback to Act 1)
  spoon: [340, 385], // spoon scoop: enters, dips, lifts a stretchy qashta ribbon (local 2.0–3.5 s)
  endCard: 400, // 13.33 s — end card (product stays on it)
  logoDots: [410, 416], // logo dots land; the sonic logo cymbal hits WITH dot 1
  sonicLogo: 410,
  cta: 428, // 14.27 s
  commentPrompt: 442,
  end: DURATION,
};

export const COPY = {
  stamp: 'مش قشطة',
  stampAfter: 'قشطة',
  erased: 'مش',
  // Air date is October: humid heat, not peak-summer 47°. Western digits throughout (as on UAE phones).
  weather: {city: 'دبي', temp: '41°', feels: 'الإحساس 48°', condition: 'حر ورطوبة عالية', humidity: 'الرطوبة 85%', hiLo: 'العظمى 42° · الصغرى 31°'},
  maps: {to: 'البيت', eta: 'ساعة و12 دقيقة', road: 'شارع الإمارات', note: 'زحمة أكتر من العادة'},
  boss: {contact: 'المدير', message: 'بكرا الساعة 7 الصبح اجتماع 🙂', time: '11:04 م'},
  family: {
    group: 'العيلة ❤️',
    unread: '37 رسالة جديدة',
    messages: [
      {from: 'ماما', text: 'مين أكل آخر قطعة كيك؟؟'},
      {from: 'سامي', text: 'مو أنا 😇'},
      {from: 'لين', text: 'كذاب 😂'},
      {from: 'بابا', text: 'رح اشتري غيرها… بعد الراتب'},
    ],
  },
  notification: {app: 'قشاطي الشام', text: 'طلبك عالباب 🛵', time: 'الآن'},
  title: 'خلّيها قشطة.',
  tagline: 'The Sweet Happiness',
  // Talabat is verified; the brand app is only confirmed on Google Play → Talabat leads.
  cta: 'اطلبها من طلبات',
  ctaSub: 'أو من تطبيق قشاطي الشام',
  location: 'ندّ الحمر · دبي',
  commentPrompt: 'وإنت؟ شو مش قشطة اليوم؟ 👇',
};


// Fonts (local files under public/qashati2/fonts, loaded with @remotion/fonts).
export const FONTS = {
  ui: 'IBM Plex Sans Arabic', // phone UI
  stamp: 'Lalezar', // rubber stamps
  display: 'Baloo Bhaijaan 2', // brand headline
  latin: 'Poppins',
};

// Safe area for Reels/TikTok UI (keep key text inside).
export const SAFE = {top: 220, bottom: 1500, left: 60, right: 960};
