// Default brand (Acumen). Override any key without touching code:
//   BRAND=brands/example.json npm start   (or node render.mjs brands/example.json)
export const brand = {
  logo: '/logo-white.svg', // any image URL in public/ (svg/png/jpg)
  logoSize: 112,
  background: '#050505',
  ink: '#F4F1EA',
  muted: '#8C8882',
  glow: '#FFC478',
  fontLatin: '/fonts/Poppins-ExtraLight.ttf',
  fontArabic: '/fonts/NotoKufiArabic-Light.ttf',
  tracking: 0.4, // em, Latin only (tracking breaks Arabic joining)
  taglineEn: 'CRAFTING THE ATMOSPHERE',
  taglineAr: 'نصنع الأجواء',
};

export type Brand = typeof brand;
