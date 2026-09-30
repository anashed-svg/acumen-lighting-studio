# Showcase 3D — ثري دي، Lottie، Rive، Theatre.js

قوالب Remotion جاهزة لشغل البراندات: مشهد فيلا ليلي ثري دي بإضاءة أكيومن، أيقونات Lottie
لأنواع الإضاءة، ريفيل لوغو بكيفريمات Theatre.js، أنيميشن Rive، ولوغو ثري دي بدون GPU.
كل شي بيرندر **أوفلاين** (ولا طلب نت من المتصفح)، والنص عربي/إنجليزي بخطوط محلية.

## التركيبات (Compositions)

| ID | الأداة | شو بيعمل |
|----|--------|----------|
| `ThreeLightScene` | `@remotion/three` + `@react-three/fiber` + drei | فيلا مودرن بالليل: أب لايت grazing على حيط حجر، بيمات ضو ظاهرة (cones)، لينير LED تحت الكانتيليفر، واشر عالواجهة، داون لايت، شجرة مضوّية، ودولي كاميرا ماشي على `useCurrentFrame` |
| `LottieShowcase` | `@remotion/lottie` + python-lottie | ٤ أيقونات متحركة (Uplight / Wall Washer / Linear LED / Spotlight) مولّدة محلياً، مع عناوين عربي وإنجليزي |
| `TheatreKeyframes` | `@theatre/core` | ريفيل لوغو: شريط ضو بيمرق ويكشف اللوغو، والكيفريمات كلها من ملف state (JSON) |
| `RiveDemo` | `@rive-app/canvas-advanced` (نفس رنتايم `@remotion/rive`) | ملف `.riv`: فريم بينرسم (trim path) وغلو دافي، وفوقه نص HTML |
| `Svg3DLogo` | `@remotion/svg-3d-engine` + `@remotion/paths` | اللوغو الـ SVG نفسه مبثوق (extruded) ثري دي، بيلف وبيلقط ضو دافي، SVG صافي بدون WebGL |

كلهم 1280×720، 30fps، ٤ ثواني (120 فريم).

## الرندر

```bash
cd video
bash smoke/showcase3d.sh     # بيولّد الأصول وبيرندر الخمسة لـ out/showcase3d/<Id>.mp4 وبيفحصهم بـ ffprobe

# وحدة وحدة:
npx remotion render src/showcase3d/index.ts ThreeLightScene out/showcase3d/ThreeLightScene.mp4 --gl=angle-egl
npx remotion studio src/showcase3d/index.ts                       # معاينة وتعديل البروبس
```

**`--gl` على سيرفر بدون GPU (جرّبناهم كلهم هون):**

| `--gl` | الرندرر الفعلي | النتيجة |
|--------|----------------|---------|
| `angle-egl` | ANGLE ← Mesa llvmpipe (OpenGL ES 3.2) | ✅ **الأسرع**: `ThreeLightScene` كاملة بـ ~25 ثانية |
| `swangle` / `swiftshader` / `angle` / `egl` / `vulkan` / بدون فلاغ | كلهم بيرجعوا لـ ANGLE ← SwiftShader (Vulkan) | ✅ بيشتغلوا بس أبطأ بمرتين (~50 ثانية) |

الصورة متطابقة بين الاتنين (PSNR ≈ 41dB). على جهاز Mac/Windows فيه GPU خلّيها default أو `--gl=angle`.
الـ smoke script بيستعمل `angle-egl`، وبتقدر تغيّرها بـ `REMOTION_GL=swangle bash smoke/showcase3d.sh`.

## تغيير البراند (Re-skin)

كل تركيبة إلها `schema` (zod)، يعني البروبس بتتعدّل من الـ Studio أو بـ `--props`:

```bash
npx remotion render src/showcase3d/index.ts ThreeLightScene out/x.mp4 --gl=angle-egl \
  --props='{"accent":"#9FD3FF","tagline":"Light, Designed","taglineAr":"ضوء مصمَّم","logo":"brands/x/logo.png","stone":"#8f8a84","render":"#e8e6e1","lightPower":1.3,"background":"#030303"}'
```

- **مشترك بين الكل:** `logo` (مسار جوّا `public/`)، `tagline`، `taglineAr`، `background`، `accent` (لون الضو).
- **ThreeLightScene:** `stone` (لون الحجر، التكستشر procedural)، `render` (لون الواجهة)، `lightPower`.
  الهندسة بـ `three/villa.tsx`، والإضاءات (`BeamLight`، `LedStrip`، `Glow`) بـ `three/lights.tsx`.
- **LottieShowcase:** `title` / `titleAr` / `items[]` (ملف + اسم إنجليزي + عربي). لون الأكسنت بيتبدّل
  وقت التحميل تلقائياً. لتوليد أيقونات بلون تاني أو تعديل الرسم:
  `python3 src/showcase3d/lottie/make_lighting_icons.py --accent 9FD3FF --line FFFFFF`
- **TheatreKeyframes:** `state` = ملف الـ state جوّا `public/`. التايمنغ والكيرفز كلها بـ
  `public/theatre/acumen-reveal.theatre.json` (position بالثواني، `handles` = bezier). أسماء الأوبجكتات
  والبروبس (`Sweep.x/intensity/warmth`، `Logo.glow/scale`، `Tagline.*`) لازم تطابق `sheet.object(...)` بالكود.
- **RiveDemo:** `riv` + `artboard` + `animation` + `wordmark` + `rivAccent`. حط ملف Rive تبع المصمم بـ `public/rive/`
  وغيّر الأسماء. الملف الموجود مولّد بـ `python3 src/showcase3d/rive/make_riv.py --accent FFC478`.
  ألوان Rive محفوظة جوّا الـ `.riv`، فوقت التحميل كل fill أو gradient stop لونه `rivAccent` بيتبدّل بـ `accent`
  (متل Lottie). أي لون تاني بالملف بيضل متل ما المصمم حطّه.
- **Svg3DLogo:** `logoSvg` (أي لوغو SVG لون واحد، paths)، `depth` (سماكة البثق)، `face` (لون الوجه).

لتركيبهم بالـ Root الرئيسي: `import {Showcase3DCompositions} from './showcase3d/compositions';` وحط
`<Showcase3DCompositions />` جوّا `Root`.

## ملاحظات تقنية

- **حتمي (deterministic):** كل حركة محسوبة من رقم الفريم (بدون `useFrame` ولا ساعات حقيقية)، والعشوائي
  بـ `random(seed)` من Remotion. فأي فريم بيطلع نفسه بأي ترتيب وبأي تاب.
- **Rive:** `@remotion/rive` (`RemotionRiveCanvas`) بيجيب `rive.wasm` من `unpkg.com`، وهاد ممنوع هون
  وكروميوم الهيدلس ما بيثق بشهادة البروكسي، فالرندر بيفشل. عشان هيك `rive/LocalRiveCanvas.tsx` بيستعمل
  نفس الرنتايم (`@rive-app/canvas-advanced` 2.31.5) بس بيحزم الـ wasm من `node_modules` مع البندل، وبيعمل
  seek مطلق لكل فريم (`animation.time = frame / fps`). على جهاز فيه نت بتقدر تستعمل الرسمي:
  `<RemotionRiveCanvas src={staticFile('rive/file.riv')} animation="reveal" />`.
  ما لقينا ولا ملف `.riv` بـ `node_modules` ولا عالجهاز، فكتبنا `make_riv.py` اللي بيكتب فورمات Rive v7
  مباشرة (أشكال، فيل/ستروك، غراديانت، trim path، كيفريمات). هاد للتجربة بس، الشغل الحقيقي بيتصمم بمحرر Rive.
- **Theatre.js:** بس `@theatre/core` وقت الرندر: `getProject(id, {state})` (الـ id فيه hash للـ state، لأن Theatre
  بيرفض بالـ Studio نفس الـ id مع state مختلفة لما تبدّل الملف أو تعدّله) وبعدين
  `sheet.sequence.position = frame / fps` وقراءة `object.value`. للتعديل البصري بدك `@theatre/studio`
  بصفحة متصفح، بتصدّر الـ JSON منها وبتحطه بـ `public/theatre/`. الربط مع الـ Studio **مش مجرّب هون** (ما في شاشة).
- **Lottie:** النصوص برّا اللوتي (HTML) لأن `lottie-web` ما بيشكّل العربي صح بطبقات النص.

## حدود البيئة (cloud بدون GPU)

- الثري دي software rendering: ٤ ثواني 720p ≈ ٢٥ ثانية بـ `angle-egl`. الـ 1080p أو الأطول بيصير أبطأ بنسبة.
- ما في ظلال (shadow maps) ولا post-processing (bloom) للسرعة. البيمات "حجمية" مزيفة (cones additive)
  والغلو sprites.
- `Svg3DLogo`: الوجه الأمامي بينرسم آخر شي، فالدوران لازم يضل أقل من ٩٠° (ما في وجه خلفي). البيرسبكتيف
  تقريبي على نقاط الكيرفز. وكل فريم آلاف الـ paths، فكمان مش أسرع من الثري دي بكتير (~٣٠ ثانية).

## الملفات

```
src/showcase3d/
  compositions.tsx, index.ts     التسجيل (fragment + registerRoot)
  brand.tsx                      خطوط، ألوان، schema مشتركة، Lockup (لوغو + تاغلاين EN/AR)
  ThreeLightScene.tsx, three/    المشهد، الفيلا، الإضاءات، تكستشر الحجر
  LottieShowcase.tsx, lottie/    التركيبة + مولّد الأيقونات (python-lottie)
  TheatreKeyframes.tsx           Theatre.js
  RiveDemo.tsx, rive/            التركيبة + LocalRiveCanvas + make_riv.py
  Svg3DLogo.tsx, svg3d/          البثق، البيرسبكتيف، الإضاءة
public/lottie/*.json  public/theatre/*.theatre.json  public/rive/*.riv
smoke/showcase3d.sh
```
