// «مش قشطة» — Qashati Alsham spot #2. Single source of truth for timing, copy and colours.
// Every component and the sound script read from here (the sound script mirrors CUES in seconds).
// 30 fps, 1080x1920, 18 s. See SPEC.md for the creative intent.

export const FPS = 30;
export const W = 1080;
export const H = 1920;
export const DURATION = 540; // 18.0 s

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

// Frame timeline.
export const T = {
  // Act 1 — "مش قشطة": four everyday Dubai screens, each gets a red stamp.
  screens: [
    {id: 'weather', start: 0, stamp: 8, clock: '14:12'},
    {id: 'maps', start: 36, stamp: 44, clock: '18:07'},
    {id: 'boss', start: 72, stamp: 80, clock: '23:04'},
    {id: 'family', start: 108, stamp: 116, clock: '23:31'},
  ],
  act1End: 144, // 4.8 s — chaos stops dead
  notification: 148, // 4.93 s — order-arrived banner + cymbal sonic logo at 150
  cymbal: 150,
  // Act 2 — the twist: two qashta drops fall on the glass and wash the word «مش» off every stamp.
  dropLand: [174, 183], // 5.8 / 6.1 s
  erase: [195, 204, 213, 222], // «مش» melts off stamp 1..4 (6.5 / 6.8 / 7.1 / 7.4 s)
  flood: 237, // 7.9 s — cream floods the screen
  // Act 3 — product.
  cupShot: 255, // 8.5 s — 3D hero shot (5 s), drops land on the dome at local 1.0 s / 1.3 s
  cupDrops: [285, 294],
  title: 315, // 10.5 s — «خلّيها قشطة.»
  endCard: 405, // 13.5 s
  logoDots: [417, 423],
  cta: 450, // 15.0 s
  sonicLogo: 480, // 16.0 s — final cymbal
  end: DURATION,
};

export const COPY = {
  stamp: 'مش قشطة',
  stampAfter: 'قشطة',
  erased: 'مش',
  weather: {city: 'دبي', temp: '47°', condition: 'مشمس وحار جداً', hiLo: 'العظمى 48° · الصغرى 36°'},
  maps: {to: 'البيت', eta: 'ساعة و١٢ دقيقة', road: 'شارع الإمارات', note: 'زحمة أكتر من العادة'},
  boss: {contact: 'المدير', message: 'بكرا الساعة ٧ الصبح اجتماع 🙂', time: '11:04 م'},
  family: {
    group: 'العيلة ❤️',
    unread: '٣٧ رسالة جديدة',
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
  cta: 'اطلبها من تطبيق قشاطي الشام',
  ctaSub: 'أو على طلبات',
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
