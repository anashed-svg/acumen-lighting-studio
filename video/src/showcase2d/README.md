# Showcase 2D — عدّة الموشن جرافيك 2D (Remotion)

تلات تمبليتات جاهزين للبراندات الكبيرة، مبنيين على هوية أكيومن (أسود وأبيض، مساحات غامقة، لمعة ضو دافية `#FFC478`،
Poppins خفيف بتباعد عريض) وبيدعموا العربي والإنجليزي. كل شي بيتغيّر من الـ props، فبتقدر تلبّسهم لأي براند تاني.

| Composition | شو بيعمل | الأدوات |
|---|---|---|
| `LogoDraw` | اللوغو بينرسم خطوط رفيعة دافية مع "راس ضو" ماشي عالخط، بعدين بيتعبّى، بتطلع هالة ضو، ولمعة بتمرق عليه، وبيخلص عالتاغلاين EN + AR | `@remotion/paths` (`evolvePath`, `getLength`, `getPointAtLength`, `getSubpaths`) |
| `KineticType` | تايبوغرافي حركي بلغتين: شعاع ضو بيمرق عكلمة LIGHT وبيضوّي الحروف وحدة وحدة، العربي بينكشف من اليمين لليسار، بعدين جملة تانية كلمة كلمة | `@remotion/layout-utils` (`fitText`, `measureText`)، `spring()`، `interpolate`، GSAP timeline مربوط بالفريم |
| `TransitionsReel` | ريل من ٣ مشاهد: Linear / Wall Washer / Uplight مع ترجمة عربية | `@remotion/transitions` (wipe, slide, iris, fade)، `@remotion/light-leaks`، `@remotion/noise`، `@remotion/shapes`، `@remotion/motion-blur` (`CameraMotionBlur`)، `@remotion/starburst` |

كلهم 1920x1080، 30fps، ٤ ثواني. في كمان نسخ عمودية 1080x1920 للريلز: `LogoDrawVertical`، `KineticTypeVertical`، `TransitionsReelVertical`.

## الرندر

من مجلد `video/`:

```bash
npx remotion studio src/showcase2d/index.ts                                              # معاينة وتعديل الـ props من الشريط الجانبي
npx remotion render src/showcase2d/index.ts LogoDraw out/showcase2d/LogoDraw.mp4
npx remotion render src/showcase2d/index.ts KineticType out/showcase2d/KineticType.mp4
npx remotion render src/showcase2d/index.ts TransitionsReel out/showcase2d/TransitionsReel.mp4
npx remotion render src/showcase2d/index.ts KineticTypeVertical out/showcase2d/KineticType-9x16.mp4
npx remotion still  src/showcase2d/index.ts LogoDraw out/showcase2d/logo.png --frame=110  # صورة وحدة
```

اختبار سريع (بيعمل typecheck وبيرندر التلاتة من الصفر وبيفحصهم بـ ffprobe، ~دقيقة ونص على 4 CPUs):

```bash
bash video/smoke/showcase2d.sh
```

## تلبيس براند تاني (re-skin)

**١. الألوان والخط والنصوص — بدون ما تلمس الكود.** كل composition إلها zod schema (`brandSchema` بـ `brand.ts`):
`background`، `text`، `accent`، `arabicFont` (`Noto Kufi Arabic` | `IBM Plex Sans Arabic` | `Cairo`) ونصوص كل تمبليت.
عدّلهم من الـ Studio أو مرّرهم بـ `--props`:

```bash
npx remotion render src/showcase2d/index.ts KineticType out/showcase2d/brand-x.mp4 \
  --props='{"accent":"#7FC8FF","background":"#0A0F14","arabicFont":"Cairo","line":"Design in Motion","lineAr":"تصميم بالحركة"}'
```

**٢. اللوغو.** `LogoDraw` بيقرا المسارات من `logoPaths.ts`. لبراند جديد حوّل اللوغو لـ SVG (potrace أو Inkscape → Path → Object to Path)
وبعدين:

```bash
node src/showcase2d/svg-to-paths.mjs public/<brand>/logo.svg > src/showcase2d/logoPaths.ts
```

السكربت بيحفظ الـ `viewBox` والـ `<g transform>` تبع potrace، وسماكة الخطوط محسوبة بالبكسل فبتضل رفيعة مهما كان مقياس المسارات.
المسارات بتنرسم من الشمال لليمين حسب مكانها؛ لو اللوغو عريض كتير كبّر `size` بـ `LogoDraw.tsx`.

**٣. خط جديد.** حط ملف الـ TTF (رخصة OFL) بـ `public/fonts/`، زيده على `faces` بـ `brand.ts`، ولو عربي زيده على `ARABIC_FONTS`.

## قواعد العربي (مهمين)

- العربي **ما بينقسم حرف حرف أبداً** — الحروف بتنفصل. بنحرّكه كلمة كلمة، أو بماسك (mask) بيمشي من اليمين لليسار.
- **ما في letter-spacing عالعربي** — التباعد بيقطع وصل الحروف. التباعد العريض للاتيني بس.
- كل نص عربي عليه `dir="rtl"`؛ أول كلمة بتطلع عاليمين.
- `measureText`/`fitText` بيخزّنوا النتيجة (cache)، فلازم نقيس بعد ما الخطوط تحمّل — هاد شغل `useFontsReady()` بـ `brand.ts`.

## ملاحظات تقنية

- **GSAP حتمي:** الـ timeline دايماً `paused` وبنعمله `tl.seek(frame / fps)` بكل رندر، وبيحرّك objects عادية (مش الـ DOM).
  هيك أي فريم بيطلع نفسه بأي ترتيب وبأي عدد tabs. لا تستعمل `gsap.to()` عالوقت الحقيقي أو `useGSAP` مع الـ ticker.
- `CameraMotionBlur` بيرندر الأولاد كذا مرة بأوقات بين الفريمات، فالعنصر اللي جواه لازم يقرا `useCurrentFrame()` بنفسه (شوف `LightHead`).
- الـ `LightLeak` لونه الأصلي أصفر؛ `hueShift={30}` بيقلبه عنبري دافي قريب من `#FFC478`. وما بنخليه يغطي الكادر كله
  بـ opacity واطية — هيك بيطلع زيتي/موحّل عالخلفية الغامقة — بنعمله ماسك (mask) من طرف الشاشة اللي داخل منه الـ slide وبنخليه ساطع.
- كل الخطوط والصور محلية (`public/`) — الرندر ما بيطلب شي من النت.

## حدود البيئة الحالية

- `LightLeak` و`Starburst` بيشتغلوا بـ WebGL. هون ما في GPU، فكروميوم بيستعمل SwiftShader عالـ CPU — شغّال بس أبطأ.
  لو ظهر خطأ WebGL بجهاز تاني جرّب `--gl=swangle` أو `--gl=angle`.
- `LightLeak` و`Starburst` كـ components صاروا deprecated بـ 4.0.530 (البديل `@remotion/effects`) بس لسا شغالين تمام.
- التوقيتات مكتوبة على ١٢٠ فريم؛ لو طوّلت المدة، عدّل أرقام `interpolate` / الـ GSAP timeline أو `SCENES` بـ `TransitionsReel.tsx`.
- الـ smoke بيرندر نسخ 16:9 بس؛ العمودية متأكدين منها بـ stills.

## الملفات

```
src/showcase2d/
  compositions.tsx     # Showcase2DCompositions — fragment بينركّب على الـ Root الرئيسي
  index.ts             # entry مستقل: registerRoot(Showcase2DCompositions)
  brand.ts             # ألوان، zod schema، تحميل الخطوط، useFontsReady، useGsapTimeline
  LogoDraw.tsx  logoPaths.ts  svg-to-paths.mjs
  KineticType.tsx
  TransitionsReel.tsx  reelScenes.tsx
  tsconfig.json        # typecheck هالمجلد لحاله: npx tsc -p src/showcase2d
smoke/showcase2d.sh
public/fonts/IBMPlexSansArabic-{ExtraLight,Light}.ttf, Cairo-Light.ttf   # OFL
```

لتركيبهم بالـ Root الرئيسي: `import {Showcase2DCompositions} from './showcase2d/compositions'` وحط `<Showcase2DCompositions />` جوّا `Root`.
