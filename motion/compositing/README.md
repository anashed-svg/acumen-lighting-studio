# Compositing / Finishing — وصفات الكومبوزيت والتشطيب

هون وصفات صغيرة جاهزة للمرحلة الأخيرة من أي فيديو: حركة كاميرا عصورة، ترانزيشنات، glow، تلوين (LUT)،
grain وفينييت، عناوين عربي/إنجليزي، تايملاين MLT، وتركيب بـ moviepy مع صوت. كل وصفة سكربت لحالو
بباراميترات (`-i` دخل، `-o` خرج، القوة…)، وبيشتغل على أي فوتج: رندر Blender / Remotion / Manim أو فيديو كاميرا.
إذا ما عطيته دخل، بيولّد عينة لحالو (واجهة فيلا ليلية إجرائية) وبيحط كل شي بـ `out/`.

```bash
cd motion/compositing
bash smoke.sh          # بيعيد رندر كل الوصفات من الصفر (~2 دقيقة) + فحص ffprobe + out/frames/contact.jpg
```

## الوصفات

| الوصفة | الأداة | لشو | مثال |
|------|------|-----|------|
| `ken-burns.sh` | ffmpeg `zoompan` | دفشة/سحبة/بان ناعمة (ease) على صورة ثابتة، بدون رجفة | `./ken-burns.sh -i villa.jpg -m in -z 1.12 -f 0.6,0.5 -d 4` |
| `xfade.sh` | ffmpeg `xfade` + `acrossfade` | ترانزيشن بين كليبين أو أكتر (58 نوع + `softwipe`) | `./xfade.sh -t softwipe,fadeblack -d 0.8 a.mp4 b.mp4 c.mp4` |
| `glow.sh` | ffmpeg `split → gblur → blend=screen` | bloom دافي عالأضواء القوية بس (عتبة + نصفين قطر) | `./glow.sh -i in.mp4 -s 0.8 -r 6 -t 0.45` |
| `grade.sh` | ffmpeg `lut3d` | تلوين بـ LUT (افتراضي warm night) مع قوة، و`-c` بيعمل قبل/بعد | `./grade.sh -i in.mp4 -s 0.8 -c` |
| `luts/make_lut.py` | numpy → `.cube` | بيولّد الـ LUT من ألوان البراند (ظلال باردة، هايلايت دافي، S-curve) | `python3 luts/make_lut.py --warmth 1.2 -o luts/mine.cube` |
| `grain-vignette.sh` | ffmpeg `vignette` + `noise` | فينييت + grain سينمائي عالـ luma بس + أشرطة سينما اختيارية | `./grain-vignette.sh -i in.mp4 -g 9 -v 0.55 -b 2.39` |
| `finish.sh` | ffmpeg | كل التشطيب (LUT → glow → فينييت + grain) بـ encode واحد بدون خسارة أجيال | `./finish.sh -i in.mp4 -G 0.85 -w 0.45 -g 7` |
| `title.sh` | ffmpeg `ass` (libass) | عنوان إنجليزي بتباعد حروف متحرّك + عربي مشكّل + خط ذهبي + glow | `./title.sh -i in.mp4 -p lower -e "VILLA NOUR" -a "فيلا نور"` |
| `mlt.sh` + `mlt/acumen.mlt` | MLT `melt` | تايملاين XML: كليبين + dissolve + frei0r glow/vignette + نص Pango | `./mlt.sh mlt/acumen.mlt out/mlt.mp4` |
| `moviepy_promo.py` | moviepy 2 | title card ← crossfade ← كليب، مع صوت خلفية مولّد (numpy) و fade | `python3 moviepy_promo.py --clip in.mp4 --card 2.4 --shot 2.4` |
| `light_sweep.py` | numpy + OpenCV | ضو دافي بيمسح حيط محكّك (N·L حقيقي) وبعدين halo اللوغو بيضوي | `python3 light_sweep.py --intensity 1.2 -d 4` |
| `facade.py` | numpy + OpenCV | صورة فيلا ليلية إجرائية (placeholder) للتجارب | `python3 facade.py --size 2560x1440` |

ملفات مساعدة: `_lib.sh` (قراءة البراند + فلاتر ffmpeg جاهزة `fg_grade` / `fg_glow` / `fg_grain_vignette` / `fg_bars`)،
`brandkit.py` (البراند، الألوان، نص عربي/لاتيني بـ Pillow + raqm، كاتب ffmpeg)، و`smoke.sh`.

كل سكربت عنده `-h`. الحجم والفريمات: `SIZE=1920x1080 FPS=25 ./ken-burns.sh ...` (الافتراضي 1280x720 @ 30).
المسارات النسبية بتنحسب من المجلد اللي انت فيه، يعني بتقدر تشغّلها من أي مكان:
`motion/compositing/glow.sh -i video/out/acumen-intro.mp4 -o /tmp/x.mp4`.

### ترتيب منيح للشغل الحقيقي

```bash
./ken-burns.sh -i render.png -o out/shot1.mp4               # أو فوتج جاهز
./xfade.sh -t softwipe -o out/cut.mp4 out/shot1.mp4 other.mp4
./title.sh -i out/cut.mp4 -p lower -o out/titled.mp4
./finish.sh -i out/titled.mp4 -b 2.39 -o out/final.mp4       # التشطيب دايمًا آخر شي وبمرّة وحدة
```

## العربي بـ ffmpeg — نتيجة الفحص

ffmpeg 6.1 هون مبني مع `--enable-libharfbuzz --enable-libfribidi`، و`drawtext` فيه `text_shaping`
(افتراضي شغّال) → **العربي بيطلع موصول ومشكّل ومن اليمين لليسار**، فما احتجنا `arabic-title.py` (Pillow).
`smoke.sh` بيتأكد من هالشي كل مرة. مثال drawtext سريع:

```bash
ffmpeg -i in.mp4 -vf "drawtext=fontfile=../../video/public/fonts/NotoKufiArabic-Light.ttf:text='نصنع الأجواء':fontsize=48:fontcolor=white:x=(w-tw)/2:y=h*0.8" out.mp4
```

بس `drawtext` **ما فيه letter-spacing**، فـ `title.sh` بيستعمل libass (فلتر `ass`): تباعد حروف حقيقي ومتحرّك
(`\fsp` + `\t`)، fades، طبقة glow بـ `\blur`، وخط رسم (`\p1`). نفس HarfBuzz/FriBidi بيشكّلوا العربي.
العربي **ما بينعطى tracking أبدًا** (بيقطّع الحروف) — هاد مقصود بكل الوصفات.

## MLT = محرّك Kdenlive و Shotcut

`melt` هو نفس المحرّك اللي جوّا **Kdenlive** و **Shotcut**، يعني أي مشروع منهم بيترندر headless بنفس الطريقة:

```bash
./mlt.sh ~/projects/promo.kdenlive out/promo.mp4          # أو مشروع Shotcut .mlt
melt promo.mlt -consumer avformat:out/promo.mp4 vcodec=libx264 crf=17 pix_fmt=yuv420p acodec=aac
```

`mlt/acumen.mlt` مثال مكتوب باليد: الواجهة بـ push-in (keyframes بـ `affine`) + `frei0r.softglow`، بعدين dissolve
(`luma` بدون صورة wipe) لكارت فيه اللوغو + عنوان Pango (إنجليزي بـ `letter_spacing` + عربي مشكّل)، و`frei0r.vignette`
عالكل. المسارات جوّا الـ XML نسبية لمكان الملف.

## تغيير البراند (Re-skin)

كل شي بيقرا `brand.json`. انسخ `brands/example.json` وعدّل:

| المفتاح | شو بيعمل |
|------|-----|
| `logo_png` | لوغو PNG أبيض عخلفية شفافة (مسار نسبي لملف الـ JSON) — `light_sweep.py` و `moviepy_promo.py` |
| `font_latin` / `font_arabic` | **مسار ملف** الخط (.ttf)، مش اسم عيلة. `title.sh` بيقرا اسم العيلة من الملف لحالو |
| `background` / `ink` / `glow` | الخلفية، لون النص، لون الضو (tint الـ glow، الخط الذهبي، ضو light_sweep) |
| `shadow_tint` | لون الظلال بالـ LUT (مع `glow` للهايلايت) |
| `tracking_em` | تباعد الحروف اللاتينية بالـ em (Acumen: 0.38) |
| `tagline_en` / `tagline_ar` | النص الافتراضي للعناوين |

```bash
BRAND=brands/mybrand.json ./title.sh -i in.mp4 -o out/mybrand-title.mp4      # سكربتات bash: متغيّر BRAND
python3 light_sweep.py --brand brands/mybrand.json -o out/mybrand-sweep.mp4    # بايثون: --brand
python3 luts/make_lut.py --brand brands/mybrand.json -o luts/mybrand.cube && ./grade.sh -l luts/mybrand.cube
```

`mlt/acumen.mlt` مش مربوط بـ `brand.json` — عدّل الألوان والنصوص والمسارات جوّا الـ XML مباشرة.
انتبه بخطوط Pango: خطوط Google الستاتيك هون مسجّلة كعيلة لحالها (`fc-list | grep Poppins` → `Poppins ExtraLight`)،
و`font_desc="Poppins ExtraLight 19"` بيطلع **Regular** بدون أي خطأ. اكتبها هيك: `"Poppins ExtraLight,Poppins Ultra-Light 19"`
(الفاصلة = قائمة عائلات)، وتأكّد بـ `pango-view -q --font="..." --text=Test -o t.png`.

## الصوت

`moviepy_promo.py` بيولّد bed بـ numpy: pad (A minor add9) مع detune يمين/يسار، "هوا" من noise مفلتر،
وضربة sub + chime ناعمة عالقطع، مع `AudioFadeIn/AudioFadeOut`. بديل سريع بـ sox:

```bash
sox -n -r 48000 -c 2 out/bed.wav synth 4 pinknoise band -n 2500 1500 tremolo 0.25 30 gain -10 fade q 0.5 4 1
```

## حدود بهالبيئة (مهم)

- **ما في GPU:** كل شي CPU. `light_sweep.py` بياخد ~25 ثانية لـ 4 ثواني 720p، الباقي 3–15 ثانية للوصفة.
- **zoompan** بيقصّ على بكسلات صحيحة → السكربت بيكبّر الصورة 4 مرات قبل الحركة (`SS=4`) عشان ما ترجف.
  لحركات طويلة كتير على صور فيها تفاصيل ناعمة، كبّر `SS`.
- **الـ LUT** معمول لفوتج Rec.709/sRGB جاهز (مش log). فوتج كاميرا log: حط LUT تحويل الكاميرا أول.
- **xfade** بيوحّد الحجم والفريمات لحالو؛ الصوت بيعمل crossfade بس إذا **كل** الكليبات فيها صوت، غير هيك بيطلع بدون صوت.
- **MLT:** خدمات Qt (`qimage`, `qtext`, `kdenlivetitle`, `qtblend`) بدها X — `mlt.sh` بيلفّها بـ `xvfb-run` لحالو
  (`QT_QPA_PLATFORM=offscreen` ما بيكفّي). المثال بيستعمل `pixbuf` + `pango` فما بيحتاج X.
  جرّبنا `qtext` عبر `mlt.sh` بدون DISPLAY: بيترندر والعربي موصول، بس بتطلع **خطوط رفيعة عند وصلات الحروف**
  (seams) — للعناوين العربية استعمل `pango` مش `qtext`/`kdenlivetitle`.
  `frei0r.glow` بيغبّش الصورة كلها ويفتّحها — استعمل `frei0r.softglow`. فلاتر `movit.*` (GPU) بمشاريع Kdenlive
  ممكن تفشل أو تكون بطيئة كتير هون. **ما جرّبنا ملف .kdenlive حقيقي** (ما في واحد بالريبو) — بس `melt` بيقبله رسميًا.
- **moviepy 2:** `TextClip` ما فيه letter-spacing، فالنصوص بتنرسم بـ Pillow + raqm (`brandkit.text_image`).
- `facade.py` و`light_sweep.py` placeholders إجرائية للتجربة، مش رندر حقيقي — بدّلهم بصور/رندرات المشروع.
  وصوت الـ bed placeholder كمان، مش موسيقى إنتاج.
- كل الخرج بـ `out/` (متجاهَل بـ git). الـ LUT الوحيد المحفوظ: `luts/acumen-warm-night.cube` (17³، ‏132KB)؛
  `smoke.sh` بيفشل إذا صار مختلف عن اللي بيطلع من `make_lut.py`.
