# Vector / 2D — Lottie، Synfig، Inkscape، وSVG بالبايثون

أدوات الفكتور والأنيميشن الـ 2D: لوغو **بينرسم خط بخط** وبعدين بيولّع، ضو دافي، تاغلاين إنجليزي + عربي
(متشبّك ومن اليمين لليسار)، وتحويل لوغوهات الزباين من صورة (PNG/JPG) لـ **SVG نظيف** جاهز للأنيميشن.
كل شي بينعمل بالكود، ونفس القوالب بتشتغل لأي براند بتغيير ملف JSON واحد.

## الملفات

| الملف | لشو |
|------|-----|
| `make_lottie.py` | **python-lottie**: بيبني Lottie JSON بالكود (لوغو stroke-draw + أشعة ضو + glow بيتنفّس + خط LED + تاغلاين) ← MP4 و GIF |
| `synfig/glow.sif` | ملف **Synfig** مكتوب باليد (XML): ضو دافي بيكبر من نقطة، اللوغو بيطلع فيه مع أشعة (radial blur)، خط LED، تاغلاين |
| `render_synfig.py` | بيعبّي قيم البراند بالـ `.sif` وبيرندره: synfig ← PNG frames ← ffmpeg |
| `svg_draw.py` | **SVG بالبايثون**: drawsvg + svgpathtools (أطوال المسارات) + cairosvg + bloom بـ PIL ← MP4، أو فريم SVG فكتور |
| `inkscape_export.sh` | **Inkscape CLI**: SVG ← PNG بدقة 4K/8K، PDF، أو SVG نصوصه محوّلة لمسارات (العربي بيضل مظبوط) |
| `vectorize.sh` | لوغو زبون صورة ← SVG بـ **potrace** + معاينة بـ rsvg-convert |
| `common.py` | مشترك: قراءة البراند، الخطوط، نص ← مسارات بـ HarfBuzz، تقسيم اللوغو لمسارات مع أطوالها، كتابة ffmpeg |
| `brand.json` / `brands/example.json` | هوية Acumen، ومثال براند تاني (أزرق بارد + لوغو زبون مفكتر) |
| `assets/acumen-lines.json` | Lottie صغير (512×512، شفاف، 2.5 ث): رسم اللوغو ثم تعبئته — جاهز لـ Remotion/الويب |
| `assets/sample-client-logo.jpg/.svg` | لوغو زبون وهمي (أسود على أبيض) ونسخته المفكترة، للتجربة |
| `assets/tagline-text.svg` | قالب SVG بنص حي (عربي + إنجليزي) لتجربة تحويل النص لمسارات |
| `smoke.sh` | بيعيد رندر كل العينات من الصفر وبيفشل إذا في شي ناقص أو فاضي أو واقف |

كل المخرجات بتروح على `out/` (مش داخلة بـ git).

## 1) python-lottie — `make_lottie.py`

```bash
cd motion/vector
python3 make_lottie.py                  # out/lottie/acumen.json + acumen-lines.json (بأقل من ثانية)
python3 make_lottie.py --mp4 --gif      # + acumen.mp4 (H.264، ~17 ث) + acumen.gif (640px، ~6 ث)
python3 make_lottie.py --still 3.5      # + فريم PNG واحد للمعاينة السريعة
python3 make_lottie.py --assets         # كمان بيحدّث assets/<brand>-lines.json
```

- اللوغو بيفوت عبر **مستورد الـ SVG تبع python-lottie** (`import_svg`)، وكل حرف بياخد **Trim Path** (stroke-draw)
  بلون الضو، بعدين التعبئة بتطلع والخط بيختفي. الإطار (أي شكل بيحاوط الكل) بينرسم أول، وبعدين الحروف من الشمال لليمين.
- الأشعة والـ glow هنن **radial gradients** (مش blur)، فبيشتغلوا بأي مشغّل Lottie.
- التاغلاين **مسارات** (HarfBuzz)، مش نص: ما بيحتاج خطوط بالمشغّل، والعربي متشبّك صح بكل مكان.
- الـ JSON جرّبناه كمان بـ **lottie-web** (نفس محرّك `@remotion/lottie`) بكروميوم headless وطلع مطابق.
- بـ Remotion: انسخ الـ JSON لـ `video/public/lottie/` واستعمل `<Lottie animationData={...} />` من `@remotion/lottie`
  (حمّل الملف بـ `fetch(staticFile(...))` جوّا `delayRender`).
- MP4: كل فريم بيترسم بـ exporter الـ cairo تبع python-lottie وبينبعت لـ x264 (yuv420p). GIF: عبر
  `lottie_convert.py out/lottie/acumen.json out.gif --width 640 --gif-skip-frames 2`.

## 2) Synfig — `synfig/glow.sif` + `render_synfig.py`

```bash
python3 render_synfig.py               # out/synfig/acumen.mp4  (96 فريم، 24fps، ~2 دقيقة)
python3 render_synfig.py --still 3.5   # فريم PNG واحد (~2 ث)
synfig "$PWD/synfig/glow.sif" --time 3s -o out/f.png   # رندر مباشر للملف الأصلي (قيم Acumen) — مسار كامل، شوف تحت
```

- الملف مكتوب باليد وبيتفتح بـ Synfig Studio. قيم البراند (الألوان، اللوغو، الخطوط، النصوص، مكان اللوغو، تدرّج الضو)
  **exported values** بـ `<defs>` (بتبيّن بـ Library panel)، والطبقات بتربط فيها بـ `use="glow"`.
  `render_synfig.py` بيبدّل هالقيم بس ← `out/synfig/<brand>.sif` وبيرندره.
- العربي: طبقة `text` تبع Synfig 1.5 **بتشبّك العربي وبتكتبه RTL** صح (جرّبناها). الخط بينعطى كمسار `.ttf` كامل.
- الطبقات: `radial_gradient` (الضو)، `import` (اللوغو PNG)، `radial_blur` (أشعة طالعة من اللوغو)، `zoom` (push-in بطيء، قيمته `push` كمان مصدّرة)،
  `blur` + blend Add (توهّج خط الـ LED)، `text`.

## 3) Inkscape + potrace — `inkscape_export.sh` و `vectorize.sh`

```bash
./inkscape_export.sh ../../video/public/logo-white.svg             # out/inkscape/logo-white_4k.png (3840px، خلفية البراند)
./inkscape_export.sh out/svg/acumen_3.8s.svg                       # فريم كامل كـ key art 4K (3840×2160)
./inkscape_export.sh logo.svg --transparent --width 7680           # 8K بخلفية شفافة
./inkscape_export.sh assets/tagline-text.svg --paths               # نص حي ← مسارات (العربي متشبّك) + plain SVG
./inkscape_export.sh poster.svg --pdf                              # PDF فكتور للطباعة
```

**فكترة لوغو زبون** (هيك منجهّز لوغوهات البراندات الكبيرة للـ stroke-draw):

```bash
./vectorize.sh client.jpg                          # out/vectorize/client.svg + _preview.png + _compare.png
./vectorize.sh client.png -o brands/client.svg -t 60 --color '#F4F1EA'
```

| خيار | شو بيعمل |
|------|-----|
| (تلقائي) | إذا أطراف الصورة فاتحة ← لوغو غامق على خلفية فاتحة (أغلب لوغوهات الزباين)؛ إذا غامقة ← لوغو فاتح على غامق. PNG شفاف ← بيستعمل الـ alpha |
| `-i` / `--invert` | اقلب الاختيار التلقائي (إذا طلع الـ SVG مرسوم فيه الخلفية بدل اللوغو) |
| `-t N` | الـ threshold من 0 لـ 100 (افتراضي 50). ارفعه إذا أجزاء رفيعة عم تختفي، نزّله إذا الأشكال عم تنفش |
| `--turd N` | بيشيل النقط الأصغر من N بكسل² (افتراضي 10) |
| `--smooth F` | نعومة الزوايا بـ potrace: 0 حاد ← 1.33 مدوّر (افتراضي 1.0) |
| `--size N` | بيكبّر الصورة الصغيرة لـ N بكسل قبل التتبّع (افتراضي 2400) ← منحنيات أنعم |
| `--color HEX` | لون التعبئة (افتراضي أبيض، للفيديوهات الغامقة) |

الـ SVG اللي بيطلع: `<path>` لكل شكل (مع الفتحات)، وهاد بالظبط اللي بتحتاجه كل الأدوات هون (Lottie، SVG route، Manim، Remotion).
**دايمًا شوف `_compare.png`** (الأصل | الفكتور جنب بعض) قبل ما تستعمله.

## 4) SVG بالبايثون — `svg_draw.py`

```bash
python3 svg_draw.py                  # out/svg/acumen.mp4 (120 فريم، 30fps، ~30 ث)
python3 svg_draw.py --still 3.5      # out/svg/acumen_3.5s.svg (فكتور، بدون bloom) + .png (مع bloom)
```

- اللوغو بينقسم لمسارات بـ **svgpathtools** مع **طول كل مسار**، وبينرسم بـ `stroke-dasharray/dashoffset` (رسم حقيقي بسرعة ثابتة).
- بعد التعبئة، **ضو grazing** دافي بيمرق على اللوغو (linear gradient متحرّك)، التاغلاين الإنجليزي بيفتح تباعد حروفه،
  والعربي **بينكشف من اليمين لليسار** (clipPath).
- cairosvg ما فيه فلاتر، فالـ glow هو **bloom بـ PIL** (blur للأجزاء المضوية وscreen فوق الصورة).
- أي فريم هو SVG عادي ← بتقدر تطلّعه 4K بـ `inkscape_export.sh` أو تعدّله بـ Inkscape.

## تغيير البراند (Re-skin)

كل الأدوات بتقرا `brand.json`، أو أي ملف بـ `BRAND_JSON`:

```bash
./vectorize.sh ~/client-logo.jpg -o brands/client.svg
cp brands/example.json brands/client.json          # عدّل القيم، و "logo_svg": "client.svg"
BRAND_JSON=brands/client.json python3 make_lottie.py --mp4
BRAND_JSON=brands/client.json python3 svg_draw.py
BRAND_JSON=brands/client.json python3 render_synfig.py
```

| المفتاح | شو بيعمل |
|------|-----|
| `name` | اسم البراند (أسماء الملفات بتاخد اسم ملف الـ JSON، أو `name` لـ `brand.json`) |
| `logo_svg` | اللوغو SVG (نسبي لملف الـ JSON). الأفضل SVG من potrace/`vectorize.sh`: `<path>` لكل حرف |
| `logo_png` | (اختياري) نسخة PNG لـ Synfig؛ إذا مش موجودة بيتحوّل الـ SVG لـ PNG لحاله |
| `logo_draw_order` | ترتيب رسم الحروف: `ltr` (افتراضي)، `rtl` للوغوهات العربية، `file` حسب ترتيب الملف |
| `background` / `ink` / `muted` / `glow` | الخلفية، لون اللوغو والنص، الثانوي، لون الضو |
| `font_latin` / `font_arabic` | اسم العيلة (متل `Poppins`، `IBM Plex Sans Arabic`) أو مسار `.ttf` مباشرة |
| `font_latin_weight` / `font_arabic_weight` | الوزن CSS (200، 300…) ← بيدوّر على `/usr/local/share/fonts/google/<Family>/<Family>-<weight>.ttf` وبعدين `fc-match` |
| `tracking_em` | تباعد الحروف الإنجليزية بالـ em (Acumen: 0.38). ما بينطبّق عالعربي أبدًا |
| `tagline_en` / `tagline_ar` | التاغلاين |

الخط إذا مش منزّل، السكربت بيوقف برسالة واضحة (ما في fallback صامت).

## فحص سريع

```bash
bash motion/vector/smoke.sh      # ~4 دقايق على 4 CPU، آخر سطر: ALL OK
```

بيرندر كل شي من الصفر (Acumen + re-skin لـ example)، وبيتأكد: كل MP4 فيه video stream، مدته ≤ 4 ث، مش أسود،
وفي حركة بين 0.5 و 3.5 ث؛ الـ GIF فيه فريمات؛ الـ JSONs صالحة؛ الـ PNGs بالدقة المطلوبة؛ ما في `<text>` بعد التحويل؛
وعدد المسارات بكل SVG مفكتر منطقي.

## حدود بهالبيئة (مهم)

- **uharfbuzz**: (بـ `requirements-video.txt`) لتشبيك العربي وتحويله لمسارات بـ Lottie والـ SVG route.
- **python-lottie**: exporter الـ MP4 تبعه (`lottie_convert.py x.json x.mp4`) بيستعمل OpenCV بكوديك MP4V (MPEG-4 part 2) — جودة
  وتوافق ضعاف، عشان هيك `--mp4` بيبعت الفريمات لـ x264. المعاينة بالـ cairo **ما بتدعم Effects** (blur/glow) — استعمل gradients.
  الـ GIF بـ 256 لون فبيطلع فيه banding بالـ glow؛ لـ GIF أنعم:
  `ffmpeg -i out/lottie/acumen.mp4 -vf "fps=15,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" out.gif`.
- **Lottie trims**: أطراف الخط `butt` لأن cairo بيرسم نقطة للـ trim اللي طوله صفر مع أطراف مدوّرة (lottie-web ما عنده هالمشكلة).
- **python-lottie renderer**: بياخد **stroke واحد بس لكل group** (الأخير) — إذا بدك core + glow على نفس الخط (متل خط الـ LED)،
  حط كل stroke بـ sub-group لحاله مع نسخة من الـ path والـ trim؛ هيك الـ MP4 والـ lottie-web بيطلعوا متطابقين.
- **Synfig**: بارامتر `compress` (تباعد الحروف) بيوزّع المسافات مش متساوية، فالتباعد معمول بمسافات بين الحروف (≈0.28em
  بـ Poppins). وزن الخط عبر `weight`/اسم العيلة مش موثوق ← مرّر مسار `.ttf`. `-t ffmpeg` بيطلّع yuv444p (ما بيشتغل بكل
  المشغّلات) وبدو `--video-bitrate`، فمنرندر PNG ← ffmpeg. `radial_blur` single-threaded (~1 ث/فريم) وهو أغلى شي بالمشهد.
  `--time` بدها وحدة (`3s`)، بلاها بتنحسب فريمات. استيراد SVG بـ Synfig مش موثوق ← منحوّله PNG بـ rsvg-convert.
  انتبه: إذا عطيت synfig مسار `.sif` نسبي فيه مجلد (متل `synfig/glow.sif`) بيضيّع الـ `import` النسبي (اللوغو) **بلا أي خطأ**؛
  استعمل مسار كامل (`"$PWD/synfig/glow.sif"`) أو شغّله من جوّا `synfig/`. `render_synfig.py` بيكتب مسارات كاملة فما بيتأثر.
  الـ `.sif` فيه `gamma 1.0` فقيم الألوان هي نفسها الـ hex.
- **Inkscape**: بيطبع تحذير GTK (`GtkRecentManager`) بلا شاشة — مش مشكلة ومنخبّيه. **`font-weight` ما بيشتغل** مع عيلات
  Google الثابتة هون (Poppins 200 بيطلع 400) ← اكتب اسم العيلة الكامل: `font-family="Poppins ExtraLight"`.
- **cairosvg**: ما بيدعم فلاتر SVG (`feGaussianBlur`) ولا تشبيك نصوص ← النصوص مسارات والـ glow بـ PIL.
- **potrace**: بيطلّع لون واحد (silhouette). لوغو ملوّن ← افصل كل لون لحاله أو كمّل بـ Inkscape. الصور والتدرجات ما بتتفكتر.
  لوغو صغير/مضغوط كتير ← جرّب `-t` و `--turd`، وشوف `_compare.png`.
- ما في GPU؛ كل الرندر CPU. ما في صوت؛ ركّب الموسيقى بعدين بـ ffmpeg أو Remotion.
