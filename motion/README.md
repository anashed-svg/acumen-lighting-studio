# عدّة الموشن غرافيك — الفهرس الكامل

كل أدوات الموشن غرافيك يلي بتشتغل على هالبيئة (Linux، بدون GPU) منزّلة ومجرّبة.
لكل عيلة أدوات في **قالب شغّال** بهوية Acumen (عربي + إنجليزي) و **smoke test** بيرندر من الصفر.

```bash
bash scripts/setup-video-tools.sh     # تنزيل كل شي (أول مرة بكل جلسة جديدة)
bash scripts/smoke-all.sh             # رندر كل العينات والتأكد إنها شغّالة (~25 دقيقة)
bash scripts/smoke-all.sh manim blender   # بس هدول
```

---

## بدي أعمل… شو بستعمل؟

| الشغلة | الأداة | القالب الجاهز |
|---|---|---|
| لوغو بينرسم خط بخط وبيضوي | Remotion `@remotion/paths` | `video/src/showcase2d` → `LogoDraw` |
| تايبوغرافي حركي عربي + إنجليزي | Remotion + GSAP + `layout-utils` | `video/src/showcase2d` → `KineticType` |
| ترانزيشنز، light leaks، motion blur | `@remotion/transitions` + `light-leaks` + `motion-blur` | `video/src/showcase2d` → `TransitionsReel` |
| مشهد 3D بالمتصفح (فيلا، بيمات ضو) | Three.js / React Three Fiber (+ `@react-three/postprocessing` للـ bloom) | `video/src/showcase3d` → `ThreeLightScene` |
| إفكت ضو حقيقي (wall wash، god rays) | Skia shaders (SkSL) | `video/src/showcaseFx` → `SkiaLightShader` |
| لوور ثيرد / كرت مشروع لأي براند | Tailwind v4 + zod props | `video/src/showcaseFx` → `BrandLowerThird` |
| ترجمة ستايل تيك توك | `@remotion/captions` | `video/src/showcaseFx` → `SocialCaptions` |
| أيقونات Lottie / Rive / كيفريمات Theatre.js | `@remotion/lottie`، Rive، `@theatre/core` | `video/src/showcase3d` |
| رندر 3D واقعي (Cycles) لفيلا أو لوغو معدني | Blender 4.0 (CLI) — و Blender 5 كموديول | `motion/blender` |
| أنيميشن شرح تقني (زاوية الشعاع، معادلات) | Manim | `motion/manim` |
| أنيميشن بالكود مع محرّر لايف | Motion Canvas / Revideo | `motion/motion-canvas`، `motion/revideo` |
| Lottie JSON للويب والتطبيقات | python-lottie | `motion/vector` |
| أنيميشن 2D فكتور (keyframes) | Synfig | `motion/vector/synfig` |
| تحويل لوغو زبون (صورة) لـ SVG | potrace (أبيض/أسود)، vtracer (ملوّن) | `motion/vector/vectorize.sh` |
| تلوين (LUT)، glow، grain، Ken Burns، ترانزيشنز | ffmpeg | `motion/compositing` |
| تايملاين مونتاج (محرّك Kdenlive/Shotcut) | MLT `melt` + frei0r | `motion/compositing/mlt` |
| مزامنة الحركة مع البيت تبع الموسيقى | librosa / aubio | — (بيطلّع JSON للتوقيتات) |
| ترجمة عربي محروقة عالفيديو | pysubs2 (ASS) + ffmpeg libass | `motion/compositing/title.sh` |

كل القوالب بتقبل **براند تاني** (لوغو، ألوان، خطوط، نصوص) — شوف قسم "Re-skin" بـ README كل مجلد.

---

## كل شي منزّل

**فريموركات موشن بالكود**
- **Remotion 4.0.530** (`video/`) مع كل الإضافات: transitions, shapes, paths, noise, motion-blur, three, lottie, rive, skia, tailwind-v4, light-leaks, starburst, sfx, captions, layout-utils, animation-utils, gif, svg-3d-engine, rounded-text-box, player, zod-types
- مكتبات ويب: GSAP 3 (مع SplitText / DrawSVG / MorphSVG)، Theatre.js، anime.js، Motion، D3، Pixi.js، three.quarks (particles)، lygia (GLSL)، gl-transitions، harfbuzzjs (تشكيل عربي لمسارات)، lottie-colorify، dotLottie
- **Motion Canvas 3.17** و **Revideo 0.11** (`motion/`)
- **Manim 0.21** + LaTeX

**3D**
- **Blender 4.0.2** (`blender`، Cycles + EEVEE + Workbench) + OIDN denoise عن طريق `pyoidn`
- **Blender 5.0.1** كموديول بايثون: `/opt/bpy5/bin/python script.py` (Cycles + OIDN مدمج + OSL + USD). القوالب بـ `motion/blender` مكتوبة لـ 4.0 — Blender 5 غيّر API الأنيميشن والكومبوزيتر
- Three.js / R3F / drei / postprocessing

**2D / فكتور / Lottie**
- Synfig 1.5، Inkscape 1.2، potrace، vtracer، python-lottie، rlottie، drawsvg، cairosvg، svgpathtools، skia-python، svgo، uharfbuzz، fontTools

**كومبوزيت وتشطيب**
- ffmpeg 6.1 (x264/x265/ProRes/VP9/AV1، lut3d، libass، vidstab، frei0r)، MLT `melt` + frei0r، G'MIC، ImageMagick، MoviePy، OpenCV، OpenImageIO/OpenEXR، OpenColorIO، colour-science، OpenTimelineIO (تسليم للمونتير: Premiere/Resolve/FCP)

**صوت**
- librosa، aubio (`aubiotrack`، `aubioonset`)، pedalboard، sox، pysubs2، edge-tts، ElevenLabs

**خطوط** — 69 عيلة (Cairo، Tajawal، Almarai، IBM Plex Arabic، Readex Pro، Noto Kufi، Montserrat، Playfair، Bebas…) بـ `/usr/local/share/fonts/google` — `scripts/install-fonts.sh`

---

## المجلدات والـ smoke tests

| المجلد | شو فيه | الفحص |
|---|---|---|
| `video/src/showcase2d` | LogoDraw، KineticType، TransitionsReel (+ نسخ 9:16) | `bash video/smoke/showcase2d.sh` |
| `video/src/showcase3d` | ThreeLightScene، LottieShowcase، TheatreKeyframes، RiveDemo، Svg3DLogo | `bash video/smoke/showcase3d.sh` |
| `video/src/showcaseFx` | SkiaLightShader، BrandLowerThird، SocialCaptions | `bash video/smoke/showcaseFx.sh` |
| `motion/manim` | LogoReveal، BeamAngle | `bash motion/manim/smoke.sh` |
| `motion/blender` | فيلا ليلية + لوغو 3D (ProRes 4444 مع alpha) | `bash motion/blender/smoke.sh` |
| `motion/revideo` | logoReveal (رندر headless) | `bash motion/revideo/smoke.sh` |
| `motion/motion-canvas` | facade (رندر عن طريق المحرّر) | `bash motion/motion-canvas/smoke.sh` |
| `motion/vector` | Lottie، Synfig، Inkscape، vectorize، SVG بالبايثون | `bash motion/vector/smoke.sh` |
| `motion/compositing` | 12 وصفة ffmpeg / MLT / Python | `bash motion/compositing/smoke.sh` |

كل تركيبات Remotion بتبيّن بمكان واحد: `cd video && npm run studio`.

---

## شو ما بيشتغل هون، وشو البديل

| البرنامج | ليش لأ | البديل هون |
|---|---|---|
| After Effects (+ Trapcode، Optical Flares، Element 3D) | تجاري، Windows/Mac، GUI | Remotion + GSAP + light-leaks/motion-blur + Skia shaders + three.quarks |
| أتمتة قوالب AE (nexrender، Templater، Plainly) | بدها After Effects | تركيبات Remotion بـ zod props، رندر دفعات من JSON/CSV |
| Cinema 4D + Redshift/Octane، V-Ray، KeyShot | تجاري، GPU | Blender Cycles (مع IES lights) |
| Unreal / Twinmotion / Lumion / D5 | Windows + كرت RTX | Blender، أو Three.js بـ Remotion |
| DIALux / Relux (حسابات إضاءة) | تجاري Windows | Blender Cycles + IES + false-color |
| Cavalry | تجاري Mac/Windows | Remotion، Motion Canvas |
| Houdini | تجاري + تسجيل + GPU | Blender Geometry Nodes / Simulation |
| DaVinci Resolve / Fusion، Nuke | GPU + GUI / تجاري | ffmpeg (lut3d)، OCIO، OpenImageIO، كومبوزيتر Blender |
| Premiere / Final Cut | تجاري | MLT، MoviePy، ffmpeg + OpenTimelineIO للتسليم |
| Illustrator / Figma | تجاري / SaaS | Inkscape، svgo، drawsvg، potrace/vtracer |
| Rive Editor، Spline، LottieFiles Creator | محرّرات أونلاين (محجوبة) | بنشغّل ملفات `.riv` و Lottie محلياً؛ التأليف بالكود |
| Natron، Glaxnimate، OpenToonz، Friction | مش بـ apt، وتنزيلات GitHub محجوبة | Blender compositor، python-lottie، Synfig |
| موديلات AI (roto، upscale، Whisper) | الموديلات على Hugging Face/GitHub (محجوبة) + بدون GPU | chromakey بـ ffmpeg، OpenAI/ElevenLabs APIs للتفريغ الصوتي |
| `@remotion/google-fonts` | Chromium ما بيثق بشهادة البروكسي | خطوط محلية بـ `@remotion/fonts` (69 عيلة منزّلة) |

---

## ملاحظات مهمة

- **العربي:** ما تحرّك العربي حرف حرف — كلمة كلمة أو بماسك، وإلا بينكسر وصل الحروف.
- **أسماء الخطوط:** الأوزان الخفيفة متسجّلة كعيلة لحالها: اطلب `"Poppins Light"` مش `Poppins` + وزن 300
  (بـ Manim / Blender / Synfig / Inkscape / MLT)، وإلا بيطلعلك Regular. افحص: `fc-match "Poppins Light"`.
- **بدون GPU:** WebGL بيشتغل عالـ CPU (`angle-egl`، مضبوط بـ `video/remotion.config.ts`). Blender Cycles بـ 1080p
  تقريباً 30 ثانية للفريم — للقطع الطويلة رندر بدقة أقل أو على جهاز فيه GPU.
- **الشبكة:** npm و PyPI و apt و Google Fonts شغّالين؛ GitHub releases و unpkg و LottieFiles و Hugging Face محجوبين
  بهالبيئة (بتنفتح من إعدادات الشبكة للبيئة).
