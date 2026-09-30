import '../tailwind.css';
import {zColor} from '@remotion/zod-types';
import {AbsoluteFill, Img, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {z} from 'zod';
import {acumen} from './brand';
import {NightVilla} from './NightVilla';

export const brandLowerThirdSchema = z.object({
  label: z.string(),
  labelAr: z.string(),
  project: z.string(),
  projectAr: z.string(),
  location: z.string(),
  locationAr: z.string(),
  fixtures: z.array(z.object({en: z.string(), ar: z.string()})),
  accent: zColor(),
  text: zColor(),
  logo: z.string().describe('Image in public/, empty to hide'),
  footage: z.string().describe('Video in public/ to play underneath, empty = built-in night villa'),
});
type Props = z.infer<typeof brandLowerThirdSchema>;

export const brandLowerThirdDefaults: Props = {
  label: 'Project 07',
  labelAr: 'مشروع ٠٧',
  project: 'Villa Al Noor',
  projectAr: 'فيلا النور',
  location: 'Riyadh · Saudi Arabia',
  locationAr: 'الرياض · المملكة العربية السعودية',
  fixtures: [
    {en: 'Linear LED', ar: 'إضاءة خطية'},
    {en: 'Uplights', ar: 'كشافات أرضية'},
    {en: 'Wall Washers', ar: 'غسيل الجدران'},
    {en: 'Grazers', ar: 'إضاءة ملامسة'},
  ],
  accent: acumen.accent,
  text: acumen.text,
  logo: 'logo-white.png',
  footage: '',
};

// Text slides out of a clipped row, so it seems to emerge from the light line.
const Reveal: React.FC<{p: number; from: 'above' | 'below'; className?: string; children: React.ReactNode}> = ({
  p,
  from,
  className = '',
  children,
}) => (
  <div className={`overflow-hidden ${className}`}>
    <div style={{transform: `translateY(${(1 - p) * (from === 'below' ? 105 : -105)}%)`, opacity: Math.min(1, p * 1.4)}}>
      {children}
    </div>
  </div>
);

const Chips: React.FC<{items: string[]; arabic?: boolean; at: (i: number) => number}> = ({items, arabic, at}) => (
  <div className="mt-[22px] flex flex-wrap gap-[12px]">
    {items.map((item, i) => (
      <span
        key={i}
        className={`rounded-full border border-(--accent)/40 bg-(--accent)/5 px-[18px] py-[7px] text-(--text)/80 ${
          arabic ? 'font-["Noto_Kufi_Arabic"] text-[17px] font-light' : 'font-[Poppins] text-[13px] font-light uppercase tracking-[0.28em]'
        }`}
        style={{opacity: at(i), transform: `translateY(${(1 - at(i)) * 12}px)`}}
      >
        {item}
      </span>
    ))}
  </div>
);

export const BrandLowerThird: React.FC<Props> = ({
  label,
  labelAr,
  project,
  projectAr,
  location,
  locationAr,
  fixtures,
  accent,
  text,
  logo,
  footage,
}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();

  const exit = spring({frame, fps, delay: durationInFrames - 24, durationInFrames: 20, config: {damping: 200}});
  const enter = (delay: number) => spring({frame, fps, delay, config: {damping: 200}}) - exit;
  const line = enter(0);
  const chip = (i: number) => enter(22 + i * 4);

  return (
    <AbsoluteFill className="bg-black" style={{'--accent': accent, '--text': text} as React.CSSProperties}>
      {footage ? <OffthreadVideo src={staticFile(footage)} muted className="size-full object-cover" /> : <NightVilla accent={accent} />}
      <AbsoluteFill className="bg-linear-to-t from-black/90 from-10% via-black/55 via-35% to-transparent to-65%" />

      <div className="absolute inset-x-[120px] bottom-[96px] text-(--text)">
        <div className="flex items-end justify-between">
          <div>
            <Reveal p={enter(6)} from="below">
              <div className="font-[Poppins] text-[15px] font-light uppercase tracking-[0.42em] text-(--accent)">{label}</div>
            </Reveal>
            <Reveal p={enter(10)} from="below" className="mt-[10px]">
              <div className="font-[Poppins] text-[58px] leading-[1.15] font-extralight uppercase tracking-[0.3em]">{project}</div>
            </Reveal>
          </div>
          <div dir="rtl">
            <Reveal p={enter(6)} from="below">
              <div className='font-["Noto_Kufi_Arabic"] text-[18px] font-light text-(--accent)'>{labelAr}</div>
            </Reveal>
            <Reveal p={enter(10)} from="below" className="mt-[4px]">
              <div className='font-["Noto_Kufi_Arabic"] text-[52px] leading-[1.45] font-light'>{projectAr}</div>
            </Reveal>
          </div>
        </div>

        <div className="my-[26px] flex items-center gap-[28px]">
          <div className="h-px flex-1 origin-right bg-(--accent) shadow-[0_0_14px_var(--accent)]" style={{transform: `scaleX(${line})`}} />
          {logo ? (
            <Img
              src={staticFile(logo)}
              className="w-[76px]"
              style={{opacity: enter(4), transform: `scale(${0.85 + 0.15 * enter(4)})`}}
            />
          ) : null}
          <div className="h-px flex-1 origin-left bg-(--accent) shadow-[0_0_14px_var(--accent)]" style={{transform: `scaleX(${line})`}} />
        </div>

        <div className="flex items-start justify-between">
          <div>
            <Reveal p={enter(14)} from="above">
              <div className="font-[Poppins] text-[19px] font-light uppercase tracking-[0.3em] text-(--text)/70">{location}</div>
            </Reveal>
            <Chips items={fixtures.map((f) => f.en)} at={chip} />
          </div>
          <div dir="rtl">
            <Reveal p={enter(14)} from="above">
              <div className='font-["Noto_Kufi_Arabic"] text-[21px] font-light text-(--text)/70'>{locationAr}</div>
            </Reveal>
            <Chips items={fixtures.map((f) => f.ar)} arabic at={chip} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
