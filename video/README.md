# Acumen Video — استوديو الفيديو

أدوات إنتاج الفيديو للبراندات. كل شي بينزل بأمر واحد:

```bash
bash scripts/setup-video-tools.sh
```

> الفهرس الكامل لأدوات الموشن غرافيك (Blender، Manim، Motion Canvas، Lottie…): [`motion/README.md`](../motion/README.md)

## شو في بالعدّة

| الأداة | لشو |
|------|-----|
| **Remotion** (هالمجلد) | موشن جرافيك بـ React: إنترو/أوترو، لوغو ريفيل، تايتلز، سوشال كتات بكل المقاسات |
| **ffmpeg** | قص، دمج، تلوين، ضغط، تصدير (H.264 / H.265 / ProRes / VP9) |
| **MoviePy + OpenCV** | مونتاج وكومبوزيت بالبايثون |
| **ImageMagick / librsvg** | تجهيز الصور واللوغوهات (SVG → PNG) |
| **Veo** (`google-genai`) / **Sora** (`openai`) | توليد لقطات فيديو بالذكاء الاصطناعي |
| **Replicate / fal.ai** | موديلات فيديو تانية (Kling, Luma, Runway…) |
| **ElevenLabs / edge-tts** | فويس أوفر عربي وإنجليزي |
| **faster-whisper** | ترجمة تلقائية (SRT) من الصوت |
| **PySceneDetect / yt-dlp** | تحليل وتنزيل فيديوهات مرجعية |
| خطوط | Poppins (هوية أكيومن)، Noto Kufi/Naskh/Sans Arabic، Amiri، Inter |

## Remotion

```bash
cd video
npm run studio                                             # معاينة وتعديل مباشر بالمتصفح
npx remotion render AcumenIntro out/intro.mp4              # 16:9
npx remotion render AcumenIntroVertical out/intro-9x16.mp4 # 9:16 ريلز/تيك توك
```

كل التركيبات مسجّلة بـ `src/Root.tsx` وبتبيّن بالـ Studio. القوالب مقسّمة بمجلدات، لكل واحد README و smoke test:

| المجلد | التركيبات | الفحص |
|---|---|---|
| [`src/showcase2d`](src/showcase2d/README.md) | `LogoDraw`، `KineticType`، `TransitionsReel` (+ نسخ 9:16) | `bash smoke/showcase2d.sh` |
| [`src/showcase3d`](src/showcase3d/README.md) | `ThreeLightScene`، `LottieShowcase`، `TheatreKeyframes`، `RiveDemo`، `Svg3DLogo` | `bash smoke/showcase3d.sh` |
| [`src/showcaseFx`](src/showcaseFx/README.md) | `SkiaLightShader`، `BrandLowerThird`، `SocialCaptions` | `bash smoke/showcaseFx.sh` |

- الأصول (لوغو، خطوط، فوتج، موسيقى) بمجلد `public/`، وبنستدعيها بـ `staticFile()`.
- الخطوط محلية بـ `public/fonts` (رخصة SIL OFL) عشان الرندر ما يعتمد على النت.
- **الرخصة:** Remotion مجاني للأفراد وللشركات لحد ٣ موظفين؛ أكبر من هيك بدها
  [Company License](https://www.remotion.pro/license).

## المفاتيح (`.env`)

```
OPENAI_API_KEY=      # Sora + صور + TTS
GEMINI_API_KEY=      # Veo + Gemini
ELEVENLABS_API_KEY=  # فويس أوفر
REPLICATE_API_TOKEN= # اختياري
FAL_KEY=             # اختياري
```
