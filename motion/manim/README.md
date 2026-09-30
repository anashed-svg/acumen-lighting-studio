# Manim — أنيميشن تقني ولوغو فكتور

**Manim Community v0.21** (بايثون) منيح للشغل الدقيق: شرح مواصفات الإضاءة بالرسم والأرقام،
معادلات **LaTeX**، ولوغوهات **SVG** بتنرسم خط بخط. كل شي بينعمل بالكود فبتقدر تعيد نفس
الأنيميشن لأي براند بتغيير ملف JSON.

## الملفات

| الملف | لشو |
|------|-----|
| `scenes.py` | المشاهد: `LogoReveal` و `BeamAngle` + أدوات مساعدة (`tracked`، `arabic`، `bloom`، `led_strip`) |
| `brand.json` | هوية Acumen: اللوغو، الألوان، الخطوط، النصوص |
| `brands/example.json` | مثال براند تاني (أزرق بارد، Montserrat + IBM Plex Sans Arabic) |
| `manim.cfg` | الإعدادات: 1280x720، 30fps، كل الرندرات بـ `out/` |
| `smoke.sh` | بيعيد رندر كل العينات ويفشل إذا في شي ناقص أو فاضي |

## المشاهد

- **`LogoReveal`** (3.9 ثانية): اللوغو بينرسم (إطار + حروف) بخط دافي، بعدين بيولّع بـ glow حقيقي
  (Gaussian blur عالـ SVG)، بيطلع خط LED تحته، وبعدين التاغلاين إنجليزي بتباعد حروف عريض + عربي.
  في كمان push-in بطيء للكاميرا.
- **`BeamAngle`** (3.8 ثانية): شرح زاوية الشعاع: فكستشر على الحيط بيضوّي مخروط عالأرض،
  والزاوية بتكبر من 15° لـ 60° (`ValueTracker` + `always_redraw`). الضو بيخفّ كل ما الشعاع عرض
  (نفس اللومن على مساحة أكبر)، ولما يعرض كفاية بيلمس الحيط (grazing). عليه `MathTex` لـ θ،
  عنوان عربي "زاوية الشعاع"، وسلايدر SPOT ← FLOOD.

## الرندر

دايمًا من جوّا هالمجلد (Manim بيقرا `manim.cfg` من المجلد الحالي بس):

```bash
cd motion/manim
manim scenes.py LogoReveal -o LogoReveal      # → out/videos/LogoReveal.mp4
manim scenes.py BeamAngle  -o BeamAngle       # → out/videos/BeamAngle.mp4
bash smoke.sh                                 # كل العينات + فحص ffprobe
```

خيارات مفيدة:

```bash
manim -s scenes.py BeamAngle                          # آخر فريم PNG بس (سريع للمعاينة) → out/images/
manim -t scenes.py LogoReveal -o LogoReveal_alpha     # خلفية شفافة → .mov (qtrle/argb) للكومبوزيت
manim -r 1920,1080 scenes.py LogoReveal -o Logo_1080  # Full HD
manim --fps 60 scenes.py BeamAngle -o Beam_60         # 60fps
```

كل مشهد بياخد تقريبًا 6–8 ثواني رندر على 720p (4 CPU). لتستعمله بـ Remotion، انسخ الـ mp4/mov
لـ `video/public/` واستدعيه بـ `<OffthreadVideo src={staticFile('...')} />`.

## تغيير البراند (Re-skin)

انسخ `brand.json` (أو `brands/example.json`)، عدّل القيم، وشغّل مع `BRAND_JSON`:

```bash
cp brands/example.json brands/mybrand.json
BRAND_JSON=brands/mybrand.json manim scenes.py LogoReveal -o mybrand_LogoReveal
```

| المفتاح | شو بيعمل |
|------|-----|
| `logo_svg` | مسار اللوغو SVG (نسبي لملف الـ JSON). أول `<path>` بينرسم كإطار والباقي حرف حرف (لوغو من `<path>` واحد كمان بيشتغل) |
| `logo_recolor` | (اختياري، افتراضي `true`) بيلوّن اللوغو بلون `ink`؛ حط `false` لتخلي ألوان الـ SVG الأصلية |
| `background` / `ink` / `muted` / `glow` | الخلفية، النص الأساسي، النص الثانوي، لون الضو |
| `font_latin` / `font_arabic` / `font_weight` | أسماء الخطوط متل ما بتطلع بـ `fc-list : family`، والوزن (`LIGHT`، `THIN`، `NORMAL`…) |
| `tracking_em` | تباعد الحروف الإنجليزية بالـ em (هوية Acumen: 0.3–0.42) |
| `tagline_en` / `tagline_ar` | التاغلاين |
| `beam_*` | عناوين مشهد الشعاع، الزاوية من/لـ، وكلمات طرفين السلايدر |

> إذا الوزن الخفيف لخط معيّن متسجّل كعيلة لحالها (متل `Poppins Light` أو `Tajawal Light`)،
> اكتب الاسم الكامل بـ `font_latin`/`font_arabic`. شوف الأسماء بـ `fc-list : family | grep -i poppins`.

## حدود بهالبيئة (مهم)

- **العربي:** استعمل دايمًا `arabic()` (مبنية على `MarkupText`). `Text` العادي (manimpango 0.6.1)
  أحيانًا بيرندر نصوص RTL **فاضية بدون أي خطأ** (مثلًا "هنا" أو "زاوية")؛ الـ helper بيطلّع خطأ إذا ما انرسم شي.
  التشكيل والاتجاه RTL مظبوطين عبر Pango/HarfBuzz. ما تعمل tracking أو تقسيم حروف للعربي (بتنقطع الحروف).
- **تباعد الحروف:** `Text` ما فيه letter-spacing، فـ `tracked()` بتوزّع الحروف يدويًا (للاتيني بس).
- **LaTeX:** القالب `sfmath` بيخلّي الأرقام sans، بس θ بتضل Computer Modern italic.
- **Glow:** رندرر Cairo (CPU) ما فيه blur؛ الـ glow هو صورة blur معمولة بـ PIL من الـ SVG (`bloom`)
  أو strokes فوق بعض (`led_strip`). ما في OpenGL/GPU هون، فما تستعمل `--renderer opengl`.
- **المقاس:** التصميم 16:9. العمودي (`-r 1080,1920`) بيشتغل بس بدو ترتيب جديد للعناصر.
- ما في صوت؛ ركّب الموسيقى/الـ SFX بعدين بـ ffmpeg أو Remotion.
