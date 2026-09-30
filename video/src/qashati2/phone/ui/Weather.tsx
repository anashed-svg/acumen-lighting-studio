// 14:12 — generic weather app, light & warm. Dubai 47°.
import React from 'react';
import {COPY} from '../../spec';
import {UI_FONT, UIC} from '../theme';
import {LocationArrow, WarningIcon} from './Icons';
import {HomeBar} from './StatusBar';

const card: React.CSSProperties = {
  position: 'absolute',
  left: 44,
  width: 992,
  borderRadius: 44,
  background: 'rgba(255,255,255,0.52)',
  boxShadow: '0 2px 0 rgba(255,255,255,0.6) inset, 0 10px 30px rgba(170,90,0,0.10)',
  border: '1.5px solid rgba(255,255,255,0.55)',
};

const label: React.CSSProperties = {fontSize: 30, fontWeight: 600, color: 'rgba(80,52,20,0.62)', letterSpacing: 0.3};

const Sun: React.FC<{frame: number}> = ({frame}) => {
  const pulse = 1 + 0.025 * Math.sin(frame / 3.1);
  return (
    <div style={{position: 'absolute', left: -260, top: -170, width: 900, height: 900, pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${pulse})`,
          background:
            'radial-gradient(circle at 50% 50%, #FFFFFF 0px, #FFFDF4 70px, rgba(255,236,170,0.95) 120px, rgba(255,196,86,0.55) 230px, rgba(255,170,60,0.18) 380px, rgba(255,160,40,0) 450px)',
        }}
      />
      {/* slow rays */}
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

const hourly = [
  {t: 'الآن', i: '☀️', v: '47°'},
  {t: '15', i: '☀️', v: '48°'},
  {t: '16', i: '☀️', v: '48°'},
  {t: '17', i: '☀️', v: '46°'},
  {t: '18:37', i: '🌇', v: 'الغروب'},
  {t: '19', i: '🌙', v: '42°'},
];

const daily = [
  {d: 'اليوم', i: '☀️', lo: '36°', hi: '48°', a: 0.28, b: 0.98},
  {d: 'الجمعة', i: '☀️', lo: '35°', hi: '47°', a: 0.22, b: 0.92},
  {d: 'السبت', i: '🌤️', lo: '34°', hi: '46°', a: 0.16, b: 0.86},
];

export const WeatherScreen: React.FC<{frame: number}> = ({frame}) => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        direction: 'rtl',
        fontFamily: UI_FONT,
        color: UIC.lightText,
        background: 'linear-gradient(180deg, #FFC86A 0%, #FFD98F 22%, #FFE9BE 48%, #FFF1D8 72%, #FFF5E4 100%)',
      }}
    >
      <Sun frame={frame} />

      {/* city */}
      <div style={{position: 'absolute', top: 200, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14}}>
        <span style={{fontSize: 62, fontWeight: 600}}>{COPY.weather.city}</span>
        <LocationArrow size={40} color="#1D1B18" style={{transform: 'scaleX(-1)'}} />
      </div>
      <div style={{position: 'absolute', top: 156, width: '100%', textAlign: 'center', fontSize: 30, fontWeight: 600, color: 'rgba(60,40,15,0.55)', letterSpacing: 1}}>
        موقعي
      </div>

      {/* temperature */}
      <div
        style={{
          position: 'absolute',
          top: 268,
          width: '100%',
          textAlign: 'center',
          direction: 'ltr',
          fontSize: 300,
          fontWeight: 400,
          letterSpacing: -12,
          lineHeight: '360px',
          paddingLeft: 60,
          background: 'linear-gradient(180deg, #2A1606 30%, #7A2E08 100%)',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
        }}
      >
        {COPY.weather.temp}
      </div>
      <div style={{position: 'absolute', top: 606, width: '100%', textAlign: 'center', fontSize: 46, fontWeight: 600}}>
        {COPY.weather.condition}
      </div>
      <div style={{position: 'absolute', top: 668, width: '100%', textAlign: 'center', fontSize: 38, fontWeight: 500, color: 'rgba(40,28,12,0.75)'}}>
        {COPY.weather.hiLo}
      </div>

      {/* heat warning */}
      <div style={{...card, top: 752, height: 150, display: 'flex', alignItems: 'center', gap: 26, padding: '0 40px', boxSizing: 'border-box'}}>
        <div style={{width: 84, height: 84, borderRadius: 24, background: '#FF5A1F', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <WarningIcon size={52} color="#FFFFFF" style={{}} />
        </div>
        <div>
          <div style={{fontSize: 38, fontWeight: 700, color: '#B23A00'}}>تحذير: موجة حر شديدة</div>
          <div style={{fontSize: 31, fontWeight: 500, color: 'rgba(60,40,15,0.7)', marginTop: 2}}>تجنّب الشمس المباشرة من ١١ص حتى ٤م</div>
        </div>
      </div>

      {/* hourly */}
      <div style={{...card, top: 928, height: 300, boxSizing: 'border-box', padding: '26px 40px'}}>
        <div style={{fontSize: 31, fontWeight: 500, color: 'rgba(60,40,15,0.72)'}}>مشمس طوال اليوم. رياح حارة حتى ٢٥ كم/س.</div>
        <div style={{height: 1.5, background: 'rgba(120,70,10,0.16)', margin: '20px 0 18px'}} />
        <div style={{display: 'flex', justifyContent: 'space-between'}}>
          {hourly.map((h, i) => (
            <div key={i} style={{width: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6}}>
              <span style={{fontSize: 32, fontWeight: 600, direction: 'ltr'}}>{h.t}</span>
              <span style={{fontSize: 50, lineHeight: '64px'}}>{h.i}</span>
              <span style={{fontSize: h.v.length > 3 ? 30 : 40, fontWeight: 600, lineHeight: '52px', direction: h.v.length > 3 ? 'rtl' : 'ltr'}}>{h.v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* UV + feels like */}
      <div style={{...card, top: 1256, height: 250, width: 482, boxSizing: 'border-box', padding: '26px 36px'}}>
        <div style={label}>☀︎ الأشعة فوق البنفسجية</div>
        <div style={{fontSize: 84, fontWeight: 600, lineHeight: '100px', direction: 'ltr', textAlign: 'right'}}>11+</div>
        <div style={{fontSize: 36, fontWeight: 700, color: '#8E1FB8'}}>شديدة جداً</div>
        <div style={{position: 'relative', height: 12, borderRadius: 6, marginTop: 12, background: 'linear-gradient(270deg, #3CC35A, #F2D22E, #F58A1F, #E5302A, #8E1FB8)'}}>
          <div style={{position: 'absolute', left: 4, top: -5, width: 22, height: 22, borderRadius: 11, background: '#fff', border: '3px solid #1D1B18', boxSizing: 'border-box'}} />
        </div>
      </div>
      <div style={{...card, top: 1256, height: 250, left: 554, width: 482, boxSizing: 'border-box', padding: '26px 36px'}}>
        <div style={label}>🌡︎ الإحساس الحراري</div>
        <div style={{fontSize: 84, fontWeight: 600, lineHeight: '100px', direction: 'ltr', textAlign: 'right'}}>53°</div>
        <div style={{fontSize: 31, fontWeight: 500, color: 'rgba(60,40,15,0.72)', lineHeight: '42px'}}>الرطوبة ٥٨٪ تجعلها أحرّ من الحرارة الفعلية.</div>
      </div>

      {/* 10-day */}
      <div style={{...card, top: 1534, height: 420, boxSizing: 'border-box', padding: '26px 40px'}}>
        <div style={label}>توقعات ١٠ أيام</div>
        {daily.map((d, i) => (
          <div key={i} style={{display: 'flex', alignItems: 'center', height: 112, borderTop: i ? '1.5px solid rgba(120,70,10,0.14)' : undefined}}>
            <span style={{width: 180, fontSize: 40, fontWeight: 600}}>{d.d}</span>
            <span style={{width: 90, fontSize: 48}}>{d.i}</span>
            <span style={{width: 100, fontSize: 38, fontWeight: 500, color: 'rgba(40,28,12,0.55)', direction: 'ltr'}}>{d.lo}</span>
            <div style={{flex: 1, position: 'relative', height: 12, borderRadius: 6, background: 'rgba(120,70,10,0.15)', margin: '0 20px'}}>
              <div
                style={{
                  position: 'absolute',
                  right: `${d.a * 100}%`,
                  left: `${(1 - d.b) * 100}%`,
                  top: 0,
                  bottom: 0,
                  borderRadius: 6,
                  background: 'linear-gradient(270deg, #F9B233, #F2542D)',
                }}
              />
            </div>
            <span style={{width: 100, fontSize: 38, fontWeight: 700, direction: 'ltr', textAlign: 'left'}}>{d.hi}</span>
          </div>
        ))}
      </div>
      <HomeBar dark={false} />
    </div>
  );
};
