# Blender — موشن غرافيك 3D (فيلا ليلية + لوغو)

**Blender 4.0.2** شغّال headless (بدون شاشة). كل المشاهد بتنبنى بالكود (procedural): ما في ملفات `.blend`
لازم تنحفظ، وكل شي (ألوان الضو، اللوغو، التاغلاين، الخطوط) بيتغيّر من ملف JSON — فنفس القالب بيمشي لأي براند.

## الملفات

| الملف | لشو |
|------|-----|
| `scene.py` | **فيلا حديثة بالليل**: أرضية بلاط غامق، تراس "طاير"، بلوك علوي cantilever، بركة بتعكس الواجهة. إضاءة دافية: LED خطي تحت الـ cantilever، grazer خطي عالواجهة العلوية، 3 wall washers على الحيط الأبيض، downlights، 4 uplights بتعمل grazing على حيط حجر، LED مخفي تحت التراس، سما ليلية وضو قمر بارد خفيف. الكاميرا بتعمل push-in بطيء (~0.9 م/ث) |
| `logo.py` | **End card**: لوغو الـ SVG بيطلع extrude + bevel (معدن أو مضوّي)، بيبرم لمكانه، rim light دافي بيكشفه، ضو strip بيمسح (sweep) عالوجه، وبعدين التاغلاين إنجليزي + عربي |
| `common.py` | الأدوات المشتركة: الـ CLI، البراند، إعدادات المحركات، مواد/أضواء/صناديق، وخط الرندر كامل (رندر ← denoise ← glare/vignette ← ffmpeg) |
| `denoise.py` | **Intel Open Image Denoise** للـ Cycles (نسخة apt من Blender مبنية بدون OIDN، فمنعمله برا Blender بـ `pyoidn`) |
| `brand.json` | هوية Acumen (3000K، Poppins Light + Noto Kufi Arabic، "Crafting the Atmosphere") |
| `brands/example.json` | براند مثال: ضو بارد 6000K، لوغو `emissive` أزرق، Montserrat + IBM Plex Sans Arabic |
| `bench.sh` | بيقيس وقت الفريم لكل محرك على المشهدين |
| `smoke.sh` | بيعيد رندر كل العينات من الصفر ويفشل إذا في شي ناقص/فاضي/ما عم يتحرك |

## الرندر

من جوّا المجلد (`--out` نسبي للمجلد الحالي؛ بدونه الناتج بيروح عـ `motion/blender/out/villa` أو `out/logo` من وين ما شغّلت، والـ `brand.json` الافتراضي بيتلاقى لحاله):

```bash
cd motion/blender
blender -b --factory-startup -P scene.py -- --out out/villa --engine CYCLES --res 640x360 --frames 24 --samples 16
blender -b --factory-startup -P logo.py  -- --out out/logo  --engine CYCLES --res 640x360 --frames 48 --samples 16
bash smoke.sh          # كل العينات + فحص ffprobe (~3 دقايق)
bash bench.sh 6        # جدول أوقات المحركات
```

الناتج: فريمات PNG بـ `out/villa/0001.png…`، فيديو `out/villa.mp4` (h264, yuv420p)، وأوقات الرندر بـ `out/villa.json`.

| الخيار | شو بيعمل |
|------|-----|
| `--engine` | `CYCLES` (الافتراضي) / `BLENDER_EEVEE` / `BLENDER_WORKBENCH` (أو `EEVEE` / `WORKBENCH`) |
| `--res` `--frames` `--fps` | الدقة، عدد الفريمات، الفريم ريت (الأنيميشن محسوب نسبةً للمدة، فأي طول بيمشي) |
| `--samples` | Cycles: عدد الـ samples · EEVEE: TAA samples |
| `--denoise auto\|oidn\|off` | Cycles بس. `auto` = OIDN إذا `pyoidn` منزّل |
| `--brand brands/x.json` | ملف البراند |
| `--haze 0.012` | ضباب volumetric (بيبيّن أشعة الضو). بطيء على Cycles (×3) |
| `--transparent` | خلفية شفافة + `out/NAME.mov` (ProRes 4444 مع alpha) للكومبوزيت |
| `--save-blend` | بيحفظ `out/NAME.blend` لتفتحه بالـ GUI وتعدّل يدويًا |
| `--no-render` | بس بيبني المشهد: `--save-blend --no-render` ← `out/villa.blend` جاهز تفتحه وتعدّل عليه بالـ GUI |
| `--threads 2` | حدّد عدد الـ threads إذا في رندر تاني شغّال عالجهاز |

أمثلة:

```bash
# Full HD نهائي، 4 ثواني، 32 sample
nice -n 10 blender -b --factory-startup -P scene.py -- --out out/villa_hd --engine CYCLES --res 1920x1080 --frames 96 --samples 32
# لوغو براند تاني بخلفية شفافة لـ Remotion
blender -b --factory-startup -P logo.py -- --out out/logo_client --brand brands/example.json --transparent --frames 72
# معاينة سريعة للحركة والكادر (animatic)
blender -b --factory-startup -P scene.py -- --out out/villa_preview --engine WORKBENCH --frames 96
```

## المحركات على هالجهاز (CPU بس، 4 cores، بدون GPU)

كلهم شغّالين. EEVEE بيشتغل مباشرة بـ `-b` عبر EGL surfaceless + Mesa llvmpipe (ما بدو `xvfb-run`؛ بيطبع
`EGL Error` بالبداية وبعدين `Managed to successfully fallback to surfaceless EGL rendering` — عادي).

أوقات الفريم الواحد (مقاسة بـ `bench.sh` و`out/*.json`، وكان في رندر تاني شغّال عنفس الـ CPUs، فهي أرقام متشائمة شوي):

| المشهد @ الدقة | Cycles 16spp + OIDN | EEVEE 16 TAA | Workbench |
|------|-----|-----|-----|
| فيلا 640x360 | **3.9–6.2 ث** (+0.3 ث OIDN) | 4.5–6.3 ث (أول فريم 6–38 ث: compile للـ shaders) | 0.5 ث |
| فيلا 640x360 + `--haze 0.012` | ~20 ث | ~7 ث | — |
| فيلا 1920x1080 | ~34 ث (+2.6 ث OIDN) | ~20 ث | — |
| لوغو 640x360 | **0.4–0.7 ث** (+0.35 ث OIDN) | 1.4 ث (أول فريم 5.5 ث) | 0.4 ث |

- **Cycles + OIDN** هو الافتراضي بـ `smoke.sh`: بنفس سرعة EEVEE تقريبًا عالفيلا، أسرع عاللوغو، وفيه GI حقيقي
  (السقف تحت الـ cantilever بيضوي من الارتداد). فيلا 10 ثواني 1080p (240 فريم) ≈ ساعتين ونص على هالجهاز.
- **EEVEE**: أسرع على 1080p وبالضباب، بس ما فيه GI (عاملين ضو مخفي بيقلّد ارتداد السقف)، والانعكاسات بس SSR.
- **Workbench**: ما بيحسب الأضواء أبدًا — للـ layout والكادر والتوقيت بس.

## خط الرندر (Cycles)

`Cycles` ← passes بصيغة Radiance HDR (اللون الـ noisy + albedo + normal) ← `denoise.py` (OIDN, HDR) ←
Compositor: Fog Glow + vignette ← AgX (Medium High Contrast للفيلا، Punchy للوغو) ← PNG ← `ffmpeg`.
EEVEE و Workbench بيطلعوا PNG مباشرة بنفس الـ glare/vignette (بلا glare عالـ Workbench).

## تغيير البراند (Re-skin)

```bash
cp brands/example.json brands/client.json   # عدّل القيم
blender -b --factory-startup -P logo.py  -- --brand brands/client.json --out out/client_logo
blender -b --factory-startup -P scene.py -- --brand brands/client.json --out out/client_villa
```

| المفتاح | شو بيعمل |
|------|-----|
| `logo_svg` | مسار اللوغو (نسبي لملف الـ JSON). لازم يكون **paths معبّاة (fill)**؛ نصوص الـ SVG والـ strokes ما بتنقرا — حوّلها لـ paths بـ Inkscape |
| `logo_style` | `metal` (معدن مصقول، الحواف بتلقط الضو) أو `emissive` (الوجه بيضوي بلون `glow`) |
| `logo_metal` | لون المعدن |
| `glow` | لون الـ rim light والـ sweep ولون الإضاءة بالـ `emissive` |
| `background` / `ink` | خلفية الـ end card ولون التاغلاين |
| `light_kelvin` / `white_balance_kelvin` | حرارة ضو الفيلا وتوازن الأبيض للكاميرا (3000K على 4000K = أبيض دافي مش برتقالي) |
| `sky_zenith` / `sky_horizon` | تدرّج السما |
| `font_latin` / `font_latin_weight` / `font_arabic` / `font_arabic_weight` | أسماء الخطوط متل `fc-list : family` والوزن (300 = Light) |
| `tracking_em` | تباعد الحروف الإنجليزية بالـ em (العربي دايمًا بدون tracking) |
| `tagline_en` / `tagline_ar` | التاغلاين (فاضي = ما بيطلع) |

أبعاد الفيلا والأضواء (أماكن، قوة بالواط، زوايا) بـ `build()` بـ `scene.py` — كل ضو سطر واحد.

## العربي

Blender ما بيعمل shaping للعربي (الحروف بتطلع مقطّعة ومن الشمال لليمين). الحل هون: **Inkscape** بيرسم النص
(Pango/HarfBuzz: وصل الحروف + RTL صح)، بيحوّله لـ paths وبيعمل **union**، وبعدين Blender بيستورد الـ SVG كـ curves.
الـ union ضروري: Blender بيعبّي الـ curves المتداخلة بطريقة even-odd، فأماكن وصل الحروف (وحروف الخطوط الـ variable
متل Montserrat) كانت بتطلع ثقوب.

## حدود بهالبيئة (مهم)

- **Blender 5.0.1** كمان منزّل كموديول بايثون (فيه OIDN و OSL و USD جوّاته): `/opt/bpy5/bin/python my_script.py`.
  هالقوالب مكتوبة لـ Blender 4.0 (`blender -b -P ...`) — Blender 5 غيّر API الأنيميشن (`Action.fcurves` ← slotted actions)
  والكومبوزيتر (`scene.node_tree`)، فما بتشتغل عليه بدون تعديل.
- **OIDN مش موجود جوّا Blender** (نسخة apt). منزّلين `pyoidn` (pip، فيه Intel OIDN 2.5 الرسمي) وبنستعمله من
  `python3` برا Blender. إذا مش منزّل، `--denoise auto` بيرندر بدون denoise (مع تحذير) و `--denoise oidn` بيفشل.
- **EEVEE**: الـ Planar Reflection probes بتطلع **فاضية** على llvmpipe (بتلغي الانعكاس كمان) — منستعمل SSR بس.
  أول فريم بطيء (compile للـ shaders؛ بيصير أسرع بعد أول مرة بسبب الـ Mesa cache). ما في GI بدون bake.
- **Blender بيطلع بـ exit code 0 حتى لو السكربت فشل**؛ السكربتات هون بتعمل `sys.exit(1)` عند أي خطأ.
- **Cycles + haze** بطيء (~×3–4) والضباب بيعتّم السما شوي.
- الـ SVG importer بياخد الـ fills بس (بدون strokes/gradients)؛ اللوغو المعقد متعدد الألوان بيطلع بمادة وحدة.
- `--transparent`: ما في glare/vignette (الـ glow ما إلو alpha صحيح)؛ ضيفهم بالكومبوزيت.
- ما في GPU: للقطعات الطويلة 1080p رندر بالليل، أو خفّف لـ 1280x720 (~×0.45 من وقت 1080p).

## بـ Remotion

انسخ الفيديو لـ `video/public/` واستدعيه بـ `<OffthreadVideo src={staticFile('villa.mp4')} />`.
للوغو فوق فوتيج تاني: `--transparent` ← `out/logo.mov` (ProRes 4444 مع alpha، للـ NLE)، أو WebM شفاف للمتصفح:

```bash
ffmpeg -framerate 24 -i out/logo/%04d.png -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 24 ../../video/public/logo3d.webm
# <OffthreadVideo transparent src={staticFile('logo3d.webm')} />
```
