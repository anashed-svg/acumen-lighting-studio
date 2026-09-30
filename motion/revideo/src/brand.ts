// Default brand (Acumen). Every key can be overridden per render via
// renderVideo({variables}) — see render.mjs and brands/*.json.
export const brand = {
  logo: '/logo-white.svg', // .svg gets a line-draw reveal; .png/.jpg fades in
  logoSize: 300,
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
