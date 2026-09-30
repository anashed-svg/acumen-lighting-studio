# Revideo — أنيميشن بالكود ورندر headless من Node

**Revideo 0.11** (MIT) هو fork من Motion Canvas: نفس فكرة المشاهد بـ TypeScript و generators
(`yield*`)، بس فيه `renderVideo()` بتشغّله من سكربت Node بدون ما تفتح أي محرّر. يعني منيح
للأتمتة: نفس القالب بيطلع فيديو لكل عميل/براند من ملف JSON، أو من سيرفر (`revideo serve`).

## الملفات

| الملف | لشو |
|------|-----|
| `src/scenes/logoReveal.tsx` | المشهد: كشف اللوغو بضو دافي + سويب + LED + تاغلاين EN/AR |
| `src/brand.ts` | قيم Acumen الافتراضية (لوغو، ألوان، خطوط، نصوص) |
| `src/project.ts` | المشروع: 1280x720، 30fps، exporter = FFmpeg |
| `brands/example.json` | مثال براند تاني (أزرق بارد، لوغو PNG، Poppins Light + Cairo) |
| `render.mjs` | الرندر الـ headless (`renderVideo`) ← `out/` |
| `public/` | اللوغو والخطوط المحلية (بتنقرا من هون، ولا شي من CDN) |
| `smoke.sh` | بيعيد رندر العينات من الصفر وبيفشل إذا في شي ناقص، فاضي، أو واقف |

## المشهد `logoReveal` (4 ثواني)

- إطار اللوغو والحروف بينرسموا خط بخط بلون الضو الدافي (`end` لكل path من ملف الـ SVG)،
  بعدين بيتعبّوا أبيض.
- **Light sweep** ماشي عاللوغو بس: `Node cache` + مستطيل gradient بـ `compositeOperation="source-atop"`.
- **Bloom**: نسخة من اللوغو عليها `blur()` و `lighter`، وضو **wall-washer** عريض بيقطع الكادر كله.
- خط **LED** بيطلع من النص للأطراف مع `shadowBlur`، وبعده التاغلاين الإنجليزي (Poppins ExtraLight،
  التباعد بيضيق من 0.88em لـ 0.4em) والعربي (Noto Kufi Arabic).
- push-in بطيء للكاميرا + **film grain** (`soft-light`) بيخفي الـ banding بالخلفيات الغامقة.

## الرندر

أول مرة بس (بدون تنزيل Chromium، منستعمل الموجود):

```bash
cd motion/revideo
PUPPETEER_SKIP_DOWNLOAD=1 npm ci
```

بعدها:

```bash
node render.mjs                                  # → out/revideo-demo.mp4  (~25 ثانية)
node render.mjs brands/example.json example.mp4  # → out/example.mp4  (براند تاني)
npm run editor                                   # المحرّر: http://localhost:9000 (Render video)
npx tsc -p .                                     # فحص الأنواع
bash smoke.sh                                    # كل العينات + فحص ffprobe/الفريمات
```

- **Full HD**: بـ `src/project.ts` حط `resolutionScale: 1.5` جوّا `rendering` ← 1920x1080 بنفس
  التصميم (جرّبناه: ~52 ثانية).
- **ProRes 4444 بشفافية** (للكومبوزيت): `options: {format: 'proRes'}` بـ `project.ts` و `render.mjs`،
  اسم الملف `.mov`، و `background: null`. (موجود بـ Revideo بس ما جرّبناه هون.)
- المتصفح: `render.mjs` بياخد `CHROME_PATH` أو `PUPPETEER_EXECUTABLE_PATH`، وإلا
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

## تغيير البراند (Re-skin)

كل مفتاح بـ `src/brand.ts` بيتغيّر من JSON بدون ما تلمس الكود (بيوصل للمشهد كـ project variables
عن طريق `renderVideo({variables})`):

```bash
cp brands/example.json brands/mybrand.json   # عدّل القيم
cp ~/mybrand/logo.svg public/                 # اللوغو والخطوط لازم يكونوا بـ public/
node render.mjs brands/mybrand.json mybrand.mp4
```

| المفتاح | شو بيعمل |
|------|-----|
| `logo` | مسار اللوغو جوّا `public/`. **SVG** ← رسم خط بخط؛ **PNG/JPG** ← fade |
| `logoSize` | حجم اللوغو بالبكسل (على 720p) |
| `background` / `ink` / `muted` / `glow` | الخلفية، النص الأساسي، النص الثانوي (العربي)، لون الضو |
| `fontLatin` / `fontArabic` | ملفات TTF محلية (`/fonts/...`)؛ بتنحمّل بـ `FontFace` |
| `tracking` | تباعد حروف الإنجليزي بالـ em (العربي دايمًا بدون تباعد عشان ما تنقطع الحروف) |
| `taglineEn` / `taglineAr` | النصوص |

## حدود معروفة بهالبيئة

- **الـ exporter الافتراضي تبع Revideo (`@revideo/core/wasm`) ما بيشتغل هون**: الـ Chromium تبع
  Playwright ما فيه H.264 encoder لـ WebCodecs (`Encoder creation error`). عشان هيك `render.mjs`
  بيستعمل **`@revideo/core/ffmpeg`**: الفريمات بتنبعت للسيرفر وبتتشفّر بـ ffmpeg.
- Revideo بيجيب ffmpeg لحاله من npm (`@ffmpeg-installer`، نسخة static من 2018). `render.mjs` بيحط
  `FFMPEG_PATH=/usr/bin/ffmpeg` (6.1) إذا موجود. الفيديو الناتج فيه track صوت AAC صامت (Revideo دايمًا بيدمج صوت).
- Revideo فيه **telemetry** (PostHog): `render.mjs` و `npm run editor` بيطفّوه بـ `DISABLE_TELEMETRY=true`.
  الـ postinstall بيكتب `~/.revideo/id.txt` بس.
- واجهة المحرّر بتحاول تجيب خطوط Google و CSS من unpkg وتفحص npm للتحديثات؛ هون محجوبين، والمحرّر
  بيشتغل عادي (بس خط الواجهة بيتغيّر).
- **العربي**: استعمل `textWrap={false}` لأي `Txt` عربي. الـ wrapping بيقسم النص لـ graphemes وبيحسب
  مكان السطر من أول حرف منطقي — بالـ RTL هاد بيزيح السطر. بدون wrapping المتصفح بيعمل shaping و bidi صح.
- Revideo بيفرض `--single-process` على Chromium، فالرندر على core واحد تقريبًا (~25 ثانية لـ 4 ثواني 720p).
