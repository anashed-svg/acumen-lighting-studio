# Motion Canvas — أنيميشن بالكود مع محرّر لايف

**Motion Canvas 3.17** (MIT): مشاهد TypeScript بـ generators (`yield*`) ومحرّر بالمتصفح فيه
timeline، scene graph، وتعديل لايف (HMR) كل ما تحفظ الملف. منيح للأنيميشن الدقيق المرسوم بالخطوط
(line art، رسومات معمارية، شرح منتجات) وللتعديل البصري السريع مع العميل.

الرندر الرسمي بيصير من المحرّر (زر **Render**). هون أتمتناه: `render.mjs` بيشغّل الـ vite dev server،
بيفتح المحرّر بـ Chromium headless (playwright-core)، بيكبس Render، وبيستنى الملف.

## الملفات

| الملف | لشو |
|------|-----|
| `src/scenes/facade.tsx` | المشهد: واجهة فيلا بتنرسم خطوط، وبعدين إضاءة الليل بتولّع |
| `src/brand.ts` | قيم Acumen الافتراضية (لوغو، ألوان، خطوط، نصوص) |
| `src/project.ts` + `src/project.meta` | المشروع؛ الـ meta فيه الدقة 1280x720، 30fps، exporter = FFmpeg |
| `src/scenes/facade.meta` | بيانات المشهد (seed، time events) — المحرّر بيكتبه، خليه بالـ git |
| `vite.config.ts` | plugins تبع Motion Canvas + FFmpeg، والـ output ← `out/` |
| `brands/example.json` | مثال براند تاني (أزرق بارد، لوغو PNG، Cairo) |
| `render.mjs` | رندر headless عن طريق المحرّر (MP4 أو image sequence) |
| `smoke.sh` | `vite build` + كل العينات + فحص ffprobe/الفريمات |

## المشهد `facade` (4 ثواني)

- **الغسق**: خطوط الفيلا (كتلتين + cantilever + سقف + زجاج) بتنرسم بـ `sequence` على خلفية رمادية
  مزرقّة، وبعدين الليل بينزل (الخلفية بتغمق والخطوط بتخفت).
- **Linear LED** تحت السقف بيغسل الحيط (wall wash)، وستريب تاني تحت الـ cantilever بيرمي ضو عالأرض.
- **Uplights** عالأرض بتولّع ورا بعض مع flicker خفيف متل الـ driver الحقيقي، وضو داخلي دافي بالزجاج.
- اللوغو فوق، التاغلاين الإنجليزي (التباعد بيضيق) والعربي تحت، push-in بطيء، و film grain.
- التصميم معمول على 1280x720 بس بيكبر لحاله لأي دقة 16:9 (جرّبنا 1920x1080).

## التشغيل والرندر

أول مرة بس (بدون تنزيل متصفحات):

```bash
cd motion/motion-canvas
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci
```

**المحرّر** (للشغل اليومي):

```bash
npm start            # → http://localhost:9000
```

من الشريط اليسار ← **Video Settings** ← تحت Rendering اختار الـ exporter
(`Video (FFmpeg)` أو `Image sequence`) ← **RENDER**. الملف بيطلع بـ `out/project.mp4`
(أو `out/project/000000.png ...`).

**Headless** (بدون شاشة):

```bash
node render.mjs                                  # → out/motion-canvas-demo.mp4  (~15 ثانية)
node render.mjs brands/example.json example.mp4  # براند تاني
node render.mjs --png                            # image sequence → out/project/*.png
npm run build                                    # tsc + vite build → out/dist/ (للـ player/embed)
bash smoke.sh                                    # كلشي + الفحوصات
```

- **Full HD**: بالمحرّر غيّر resolution لـ 1920x1080 (أو بـ `src/project.meta` ← `shared.size`).
  الـ scale presets بالمحرّر بس 0.25/0.5/1/2، عشان هيك المشهد بيقيس حاله على عرض الكادر.
- `render.mjs` بيختار الـ exporter لحاله (`Video (FFmpeg)`، أو `Image sequence` مع `--png`) مهما كان
  آخر اختيار بالمحرّر، وبيرجّع `src/project.meta` متل ما كان بعد الرندر (المحرّر بيحفظ أي تغيير بالواجهة فيه).
  الدقة والـ fps بياخدهم من `project.meta`.
- المتصفح: `CHROME_PATH`، وإلا `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. البورت:
  `PORT` (الافتراضي 9410 للـ headless و 9000 لـ `npm start`).

## تغيير البراند (Re-skin)

نفس مفاتيح Revideo (`../revideo/README.md`)، بس بتوصل عن طريق متغيّر البيئة `BRAND`
(`vite.config.ts` بيقرا الـ JSON وبيدمجه فوق `src/brand.ts` كـ project variables):

```bash
cp brands/example.json brands/mybrand.json     # عدّل النصوص/الألوان/الخطوط
cp ~/mybrand/logo.svg public/                   # اللوغو والخطوط لازم يكونوا بـ public/
BRAND=brands/mybrand.json npm start             # معاينة بالمحرّر
node render.mjs brands/mybrand.json mybrand.mp4 # رندر
```

المفاتيح: `logo` (أي صورة: svg/png/jpg)، `logoSize`، `background`، `ink`، `muted`، `glow`،
`fontLatin`، `fontArabic`، `tracking`، `taglineEn`، `taglineAr`. شكل الفيلا نفسها بـ `OUTLINES`
وأماكن الضو بـ `strip(...)` و `uplight(...)` جوّا `facade.tsx`.

## حدود معروفة بهالبيئة

- ما في CLI رسمي للرندر بـ Motion Canvas؛ الأتمتة بتعتمد على نصوص الأزرار بالمحرّر
  (`Render` / `Abort`) و `select` الـ exporter. إذا تغيّرت الواجهة بنسخة جاية، لازم نعدّل `render.mjs`.
- `@motion-canvas/ffmpeg` بيستعمل دايمًا الـ ffmpeg اللي جايي مع npm (`@ffmpeg-installer`، static
  من 2018، فيه libx264) — ما بيقبل `FFMPEG_PATH`. للـ ProRes/مواصفات تانية: اعمل `--png` وشفّر بـ ffmpeg النظام.
- الـ plugins لسا بتحمّل نسخة CJS من Vite 5 (عشان هيك `VITE_CJS_IGNORE_WARNING=true`). Motion Canvas
  3.17 بيدعم Vite 4/5 بس (مش 6+).
- واجهة المحرّر بتحاول تجيب خطوط Google و CSS من unpkg وتفحص npm للتحديثات؛ `render.mjs` بيحجب
  أي طلب لبرّا الـ localhost، والمحرّر بيشتغل عادي.
- **العربي**: `textWrap={false}` لأي `Txt` عربي وبدون `letterSpacing` (نفس سبب Revideo). الـ shaping
  والـ bidi من Chromium نفسه، فالحروف متصلة وبالاتجاه الصح.
