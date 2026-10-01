// 14:12 — generic weather app, light & warm. Dubai 41°, humid. The punchline (the temperature) sits in the
// top band; the band under it stays calm (warm gradient only) because the hook stamp slams there; the
// "feels like" and humidity cards sit below the stamp so the thumbnail reads: 41° → «مش قشطة» → 48° / 85%.
import React from 'react';
import {COPY} from '../../spec';
import {UI_FONT, UIC} from '../theme';
import {LocationArrow, WarningIcon} from './Icons';
import {HomeBar} from './StatusBar';
import {Mixed, splitValue} from './Text';

const card: React.CSSProperties = {
  position: 'absolute',
  left: 44,
  width: 992,
  borderRadius: 44,
  background: 'rgba(255,255,255,0.52)',
  boxShadow: '0 2px 0 rgba(255,255,255,0.6) inset, 0 10px 30px rgba(170,90,0,0.10)',
  border: '1.5px solid rgba(255,255,255,0.55)',
  boxSizing: 'border-box',
};

const label: React.CSSProperties = {fontSize: 32, fontWeight: 600, color: 'rgba(80,52,20,0.66)', letterSpacing: 0.3};
const ltr: React.CSSProperties = {direction: 'ltr', unicodeBidi: 'isolate'};

const Sun: React.FC<{frame: number}> = ({frame}) => {
  const pulse = 1 + 0.025 * Math.sin(frame / 3.1);
  return (
    <div style={{position: 'absolute', left: -300, top: -220, width: 900, height: 900, pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${pulse})`,
          background:
            'radial-gradient(circle at 50% 50%, #FFFFFF 0px, #FFFDF4 70px, rgba(255,236,170,0.95) 120px, rgba(255,196,86,0.55) 230px, rgba(255,170,60,0.18) 380px, rgba(255,160,40,0) 450px)',
        }}
      />
      <svg width={900} height={900} style={{position: 'absolute', inset: 0, opacity: 0.35, transform: `rotate(${frame * 0.25}deg)`}}>
        {Array.from({length: 14}).map((_, i) => {
          const a = (i / 14) * Math.PI * 2;
          const r0 = 130;
          const r1 = 420 + (i % 3) * 40;
          const w = 0.05;
          const p = (r: number, da: number) => `${450 + r * Math.cos(a + da)},${450 + r * Math.sin(a + da)}`;
          return <polygon key={i} points={`${p(r0, -w)} ${p(r1, 0)} ${p(r0, w)}`} fill="#FFF6D8" />;
        })}
      </svg>
    </div>
  );
};

// A humid October afternoon in Dubai: 41° now, easing to 36° after sunset.
const hourly = [
  {t: 'الآن', i: '☀️', v: '41°'},
  {t: '15', i: '☀️', v: '41°'},
  {t: '16', i: '🌤️', v: '40°'},
  {t: '17', i: '🌤️', v: '38°'},
  {t: '18:04', i: '🌇', v: 'الغروب'},
  {t: '19', i: '🌙', v: '36°'},
];

const Thermo: React.FC = () => (
  <svg width={40} height={40} viewBox="0 0 24 24">
    <path d="M10 3.5a2 2 0 0 1 4 0v9.2a4.5 4.5 0 1 1-4 0z" fill="none" stroke="rgba(80,52,20,0.66)" strokeWidth={2} />
    <circle cx={12} cy={16.6} r={2.4} fill="#E5302A" />
    <rect x={11} y={8} width={2} height={8} rx={1} fill="#E5302A" />
  </svg>
);
const Drop: React.FC = () => (
  <svg width={40} height={40} viewBox="0 0 24 24">
    <path d="M12 3 C12 3 5.5 10.5 5.5 14.8 A6.5 6.5 0 0 0 18.5 14.8 C18.5 10.5 12 3 12 3 Z" fill="#3E8BD9" />
  </svg>
);

export const WeatherScreen: React.FC<{frame: number}> = ({frame}) => {
  const feels = splitValue(COPY.weather.feels);
  const hum = splitValue(COPY.weather.humidity);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        direction: 'rtl',
        fontFamily: UI_FONT,
        color: UIC.lightText,
        background: 'linear-gradient(180deg, #FFC86A 0%, #FFD98F 22%, #FFE6B6 44%, #FFEFD3 66%, #FFF4E2 100%)',
      }}
    >
      <Sun frame={frame} />

      {/* city */}
      <div style={{position: 'absolute', top: 150, width: '100%', textAlign: 'center', fontSize: 30, fontWeight: 600, color: 'rgba(60,40,15,0.55)', letterSpacing: 1}}>
        موقعي
      </div>
      <div style={{position: 'absolute', top: 184, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14}}>
        <span style={{fontSize: 64, fontWeight: 600, lineHeight: '84px'}}>{COPY.weather.city}</span>
        <LocationArrow size={40} color="#1D1B18" style={{transform: 'scaleX(-1)'}} />
      </div>

      {/* temperature: the punchline */}
      <div
        style={{
          position: 'absolute',
          top: 238,
          width: '100%',
          textAlign: 'center',
          direction: 'ltr',
          fontSize: 300,
          fontWeight: 400,
          letterSpacing: -10,
          lineHeight: '330px',
          paddingLeft: 56,
          boxSizing: 'border-box',
          background: 'linear-gradient(180deg, #2A1606 30%, #8A3208 100%)',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
        }}
      >
        {COPY.weather.temp}
      </div>
      <div style={{position: 'absolute', top: 556, width: '100%', textAlign: 'center', fontSize: 48, fontWeight: 600, lineHeight: '60px'}}>{COPY.weather.condition}</div>
      <div style={{position: 'absolute', top: 614, width: '100%', textAlign: 'center', fontSize: 38, fontWeight: 500, lineHeight: '48px', color: 'rgba(40,28,12,0.75)'}}>
        <Mixed text={COPY.weather.hiLo} />
      </div>

      {/* (the hook stamp lands here, on nothing but warm sky) */}

      {/* feels like + humidity: the heat, doubled */}
      {[
        {v: feels, I: Thermo, note: 'الرطوبة تزيد الإحساس بالحر.'},
        {v: hum, I: Drop, note: 'مرتفعة جداً'},
      ].map(({v, I, note}, k) => (
        <div key={k} style={{...card, top: 1000, height: 250, width: 482, left: k ? 44 : 554, padding: '24px 36px'}}>
          <div style={{...label, display: 'flex', alignItems: 'center', gap: 10}}>
            <I />
            {v.label}
          </div>
          <div style={{fontSize: 100, fontWeight: 600, lineHeight: '120px', textAlign: 'right'}}>
            <span style={ltr}>{v.value}</span>
          </div>
          <div style={{fontSize: 30, fontWeight: 500, color: 'rgba(60,40,15,0.72)', lineHeight: '40px'}}>
            <Mixed text={note} />
          </div>
        </div>
      ))}

      {/* heat alert */}
      <div style={{...card, top: 1276, height: 150, display: 'flex', alignItems: 'center', gap: 26, padding: '0 40px'}}>
        <div style={{width: 84, height: 84, borderRadius: 24, background: '#FF5A1F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
          <WarningIcon size={52} color="#FFFFFF" style={{}} />
        </div>
        <div>
          <div style={{fontSize: 38, fontWeight: 700, color: '#B23A00'}}>تنبيه: حرارة ورطوبة عالية</div>
          <div style={{fontSize: 31, fontWeight: 500, color: 'rgba(60,40,15,0.7)', marginTop: 2}}>
            <Mixed text="تجنّب الشمس المباشرة من 11 ص حتى 4 م" />
          </div>
        </div>
      </div>

      {/* hourly */}
      <div style={{...card, top: 1452, height: 300, padding: '26px 40px'}}>
        <div style={{fontSize: 31, fontWeight: 500, color: 'rgba(60,40,15,0.72)'}}>
          <Mixed text="مشمس ورطب. رياح خفيفة 15 كم/س." />
        </div>
        <div style={{height: 1.5, background: 'rgba(120,70,10,0.16)', margin: '20px 0 18px'}} />
        <div style={{display: 'flex', justifyContent: 'space-between'}}>
          {hourly.map((h, i) => (
            <div key={i} style={{width: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6}}>
              <span style={{fontSize: 32, fontWeight: 600, ...(h.t.match(/\d/) ? ltr : {})}}>{h.t}</span>
              <span style={{fontSize: 50, lineHeight: '64px'}}>{h.i}</span>
              <span style={{fontSize: h.v.length > 3 ? 30 : 40, fontWeight: 600, lineHeight: '52px', ...(h.v.match(/\d/) ? ltr : {})}}>{h.v}</span>
            </div>
          ))}
        </div>
      </div>
      <HomeBar dark={false} />
    </div>
  );
};
