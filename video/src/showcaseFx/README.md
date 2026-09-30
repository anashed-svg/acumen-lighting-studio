# showcaseFx — شيدرز Skia + قوالب Tailwind + ترجمة سوشال

تلات قوالب Remotion جاهزة لشغل البراندات، كلها عربي + إنجليزي، وكلها بتتغيّر من الـ props
(Remotion Studio أو `--props`) بدون ما تلمس الكود.

| Composition | المقاس | لشو |
|---|---|---|
| `SkiaLightShader` | 1280×720 · 30fps · 4s | شيدر **SkSL** (`@remotion/skia` + `@shopify/react-native-skia` RuntimeEffect): حيط حجر بالليل — grazers من الأرض بتبيّن ملمس الحجر، wall-wash بيمشي من الشمال لليمين، وسبوت لايت مع god rays بالضباب. فوقه اللوغو والتاغلاين |
| `BrandLowerThird` | 1920×1080 · 30fps · 4s | لوور ثيرد / كرت مشروع بـ **Tailwind v4**: اسم المشروع، الموقع، ونوع الإضاءة (fixtures) — إنجليزي عالشمال وعربي عاليمين، متحرّك بـ `spring()` وبيطلع من خط الضو |
| `SocialCaptions` | 1080×1920 · 30fps · حسب ملف الترجمة | ترجمة كلمة-كلمة ستايل تيك توك بـ `@remotion/captions` (`createTikTokStyleCaptions`) وخلفية مدوّرة بـ `@remotion/rounded-text-box`، فوق فيلا مضوّية بالليل |

`NightVilla.tsx` هي "فوتج" بديلة (SVG): فيلا مودرن فيها LED coves و uplights وانعكاس عالأرض.
بتشتغل بأي مقاس (`fit="cover"` أو `"contain"`).

## الرندر

من جوّا `video/`:

```bash
npx remotion render src/showcaseFx/index.ts SkiaLightShader out/showcaseFx/SkiaLightShader.mp4 --gl=swangle
npx remotion render src/showcaseFx/index.ts BrandLowerThird out/showcaseFx/BrandLowerThird.mp4
npx remotion render src/showcaseFx/index.ts SocialCaptions  out/showcaseFx/SocialCaptions.mp4
npx remotion studio src/showcaseFx/index.ts               # معاينة وتعديل الـ props من الشريط الجانبي
bash smoke/showcaseFx.sh                                   # بيرندر التلاتة من الصفر وبيفحصهم
```

الـ smoke بيفحص إنو كل ملف فيه video stream، وعدد الفريمات 120، والفريم عند 2.5s مش أسود
(لإنو كانفس Skia إذا فشل WebGL بيطلع فاضي بدون أي error).

**Skia والـ `react-native`:** `@shopify/react-native-skia` 2.x بيعمل `import 'react-native'`، وعالويب لازم
يتحوّل لـ `react-native-web` — هالـ alias موجود بالكونفيغ المشترك (`video/remotion.config.ts`).

## تغيير البراند (re-skin)

كل composition إلها `schema` (zod) و `defaultProps`، فالألوان بتطلع color picker بالـ Studio (`zColor`).
من سطر الأوامر:

```bash
npx remotion render src/showcaseFx/index.ts BrandLowerThird out/showcaseFx/marina.mp4 \
  --props='{"accent":"#7FD1FF","project":"Marina Tower","projectAr":"برج المارينا"}'
```

لفوتج حقيقي بدل الفيلا: حط الكليب بـ `public/` (مثلاً `public/clips/marina.mp4`) وزيد
`"footage":"clips/marina.mp4"` عالـ props — إذا الملف مش موجود الرندر بيوقف بـ 404.

| Composition | أهم الـ props |
|---|---|
| `SkiaLightShader` | `title`, `titleAr`, `lightColor` (لون الضو), `wallColor` (لون الحجر), `textColor`, `logo` |
| `BrandLowerThird` | `label/labelAr`, `project/projectAr`, `location/locationAr`, `fixtures: [{en, ar}]`, `accent`, `text`, `logo`, `footage` (فيديو بـ `public/`، فاضي = الفيلا) |
| `SocialCaptions` | `captionsFile`, `combineWithinMs`, `fontSize`, `accent`, `text`, `box`, `tagline`, `logo` |

- اللوغو والفوتج بيتحطّوا بـ `public/` وبينكتب مسارهم نسبةً إلو (مثلاً `logo-white.png`). `logo: ""` بيخبّيه.
- الخطوط محلية بـ `public/fonts` (Poppins 200/300/500 + Noto Kufi Arabic 300/500، رخصة OFL) ومحمّلة بـ `brand.ts`.
  لبراند تاني: حط ملفات الخط بـ `public/fonts` وغيّر `faces` و `LATIN`/`ARABIC` بـ `brand.ts`.
  بالـ Tailwind الخط مكتوب كـ class: `font-[Poppins]` و `font-["Noto_Kufi_Arabic"]`.
- ألوان Tailwind جاية من الـ props كـ CSS variables: `text-(--accent)`, `border-(--accent)/40`, `text-(--text)/70`.
- شكل الضو بالشيدر (عدد الـ grazers، مقاس بلاط الحجر، زاوية السبوت) بـ `lightWall.sksl.ts` — الأرقام مشروحة بتعليقات قصيرة.

## ملف الترجمة (captions)

`public/showcaseFx/captions.json` هو `Caption[]` تبع `@remotion/captions` — كلمة بكل عنصر:

```json
{"text": " الضوء", "startMs": 1400, "endMs": 1820, "timestampMs": 1610, "confidence": null}
```

- كل كلمة (إلا أول وحدة) بتبلّش **بمسافة** — هيك `createTikTokStyleCaptions` بيعرف وين يقدر يقسم الصفحات.
- الكلمات اللي بتبلّش خلال `combineWithinMs` (افتراضي 1200ms) من بداية الصفحة بيطلعوا سوا.
- مدة الفيديو بتنحسب لحالها من آخر كلمة (`calculateMetadata`)، فملف أطول = فيديو أطول.
- الصفحة اللي فيها عربي بتنعرض RTL بخط Noto Kufi، والإنجليزي Poppins uppercase؛ صفحة مخلوطة
  (`إضاءة معمارية من ACUMEN`) كل كلمة بخطها والترتيب صح.
- عندك SRT (مثلاً من faster-whisper)؟ `parseSrt()` من `@remotion/captions` بيحوّلو لـ `Caption[]`.
  توقيت كلمة-كلمة بدو whisper مع `word_timestamps=True`.

## ملاحظات وحدود البيئة

- **CanvasKit محلي 100%**: `enableSkia()` بيحط `canvaskit.wasm` جوّا الـ bundle، والكانفس بيتحمّل
  جوّا `SkiaLightShader` نفسه (`LoadSkiaWeb()` + `import()`)، فالـ composition بتشتغل بأي Root بدون
  ما نعدّل `index.ts`. جرّبناها مع Chrome net-log: كل الطلبات كانت على `http://localhost:3001` بس
  (بما فيها `/canvaskit.wasm`)، ولا طلب برّا.
- **`--gl`**: هون ما في GPU. جرّبنا `default`, `swangle`, `angle`, `egl`, `swiftshader`, `vulkan` —
  كلهم زبطوا (WebGL على SwiftShader عالـ CPU). منستعمل `--gl=swangle` (نفس افتراضي Lambda).
  فريم الفيديو طابق الـ still تبع نفس الفريم (ما في تأخير فريم).
- وقت الرندر هون (4 CPU مشتركة، `nice`): دقيقة ونص لدقيقتين لكل composition، والـ smoke كلو حوالي 6 دقايق.
- **العربي و letter-spacing**: Chrome بيفرط وصلات الحروف العربية إذا في `letter-spacing`، فالـ tracking
  العريض (0.3–0.42em) بس عالإنجليزي؛ العربي دايماً `letterSpacing: 0`.
- `measureText()` بيحفظ القياسات، فـ `SocialCaptions` بيستنّى الخطوط تتحمّل قبل ما يقيس (`useFontsReady`).
- `NightVilla` رسمة SVG بديلة، مش فوتج حقيقي — للشغل الفعلي حط فيديو بـ `footage`.
