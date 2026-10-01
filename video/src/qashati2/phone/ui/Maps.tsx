// 18:07 — generic navigation app: Emirates Road in deep red, "home" 1h12 away. The ETA (the punchline)
// is a big trip card in the top band; the map with the red route fills the rest (stamps land on the map).
import React from 'react';
import {COPY} from '../../spec';
import {UI_FONT, UIC} from '../theme';
import {CarIcon, HomeGlyph, LayersIcon, RecenterIcon, WarningIcon} from './Icons';
import {HIGHWAY, HOME, map, ROUTE, smoothPath, TRAFFIC, YOU} from './mapData';
import {HomeBar} from './StatusBar';
import {Mixed} from './Text';

const hw = smoothPath(HIGHWAY);
const route = smoothPath(ROUTE);
const trafficColor = {red: '#E0342C', dark: '#9C1812', orange: '#F29B12', blue: '#2F7BF0'};

const areaLabels: {x: number; y: number; t: string; r?: number}[] = [
  {x: 690, y: 330, t: 'الورقاء'},
  {x: 890, y: 760, t: 'المزهر'},
  {x: 318, y: 1100, t: 'ند الحمر'}, // the shop's area: kept clear of the map controls
  {x: 470, y: 1420, t: 'الخوانيج'},
  {x: 150, y: 840, t: 'مردف'},
];

const MapLayer: React.FC = React.memo(() => (
  <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
    <rect width={1080} height={1920} fill="#F2EFE8" />
    {map.sand.map((d, i) => (
      <path key={`s${i}`} d={d} fill="#F4E8CF" />
    ))}
    {map.blocks.map((d, i) => (
      <path key={`b${i}`} d={d} fill="#ECE8DF" />
    ))}
    {map.parks.map((d, i) => (
      <path key={`p${i}`} d={d} fill="#CFE9C6" />
    ))}
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {map.locals.map((d, i) => (
        <path key={`lc${i}`} d={d} stroke="#DCD7CD" strokeWidth={11} />
      ))}
      {map.locals.map((d, i) => (
        <path key={`l${i}`} d={d} stroke="#FFFFFF" strokeWidth={7.5} />
      ))}
      {map.arterials.map((d, i) => (
        <path key={`ac${i}`} d={d} stroke="#D2CCC0" strokeWidth={21} />
      ))}
      {map.arterials.map((d, i) => (
        <path key={`a${i}`} d={d} stroke="#FFFFFF" strokeWidth={16} />
      ))}
      {[map.parallel, map.crossing].map((d, i) => (
        <g key={`h${i}`}>
          <path d={d} stroke="#E0B75C" strokeWidth={30} />
          <path d={d} stroke="#FCE3A2" strokeWidth={23} />
          {/* moderate traffic on the other highways */}
          <path d={d} stroke={i ? trafficColor.orange : trafficColor.red} strokeWidth={9} pathLength={1} strokeDasharray="0.12 0.1 0.2 0.14" opacity={0.9} />
        </g>
      ))}
      <circle cx={map.interchange[0]} cy={map.interchange[1]} r={70} stroke="#E0B75C" strokeWidth={24} />
      <circle cx={map.interchange[0]} cy={map.interchange[1]} r={70} stroke="#FCE3A2" strokeWidth={17} />
      <path d={hw} stroke="#D9A94B" strokeWidth={40} />
      <path d={hw} stroke="#FDDC8C" strokeWidth={31} />
    </g>
    {areaLabels.map((l, i) => (
      <text
        key={i}
        x={l.x}
        y={l.y}
        textAnchor="middle"
        fontFamily={UI_FONT}
        fontSize={33}
        fontWeight={600}
        fill="#8A8377"
        stroke="#F2EFE8"
        strokeWidth={8}
        paintOrder="stroke"
        letterSpacing={1}
      >
        {l.t}
      </text>
    ))}
  </svg>
));

// the whole map sits lower so the route runs below the trip card, behind the stamps
const MAP_DY = 330;

export const MapsScreen: React.FC<{frame: number}> = ({frame}) => {
  const pulse = (frame % 30) / 30;
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', direction: 'rtl', fontFamily: UI_FONT, color: UIC.lightText, background: '#F2EFE8'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transform: `translateY(${MAP_DY}px) scale(1.08)`, transformOrigin: '540px 900px'}}>
        <div style={{position: 'absolute', left: 0, top: -MAP_DY - 60, width: 1080, height: 1920 + MAP_DY + 60, background: '#F2EFE8'}} />
        <MapLayer />
        <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
          <path d={route} fill="none" stroke="#5E0B08" strokeWidth={36} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} />
          {TRAFFIC.map((s, i) => (
            <path
              key={i}
              d={route}
              fill="none"
              stroke={trafficColor[s.c]}
              strokeWidth={26}
              strokeLinecap={i === 0 || i === TRAFFIC.length - 1 ? 'round' : 'butt'}
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray={`${s.to - s.from + 0.002} 2`}
              strokeDashoffset={-s.from}
            />
          ))}
          <circle cx={YOU[0]} cy={YOU[1]} r={40 + 60 * pulse} fill="#2F7BF0" opacity={0.25 * (1 - pulse)} />
          <circle cx={YOU[0]} cy={YOU[1]} r={31} fill="#FFFFFF" style={{filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.3))'}} />
          <circle cx={YOU[0]} cy={YOU[1]} r={23} fill="#2F7BF0" />
          <path d={`M${YOU[0]} ${YOU[1] - 16} L${YOU[0] + 11} ${YOU[1] + 11} L${YOU[0]} ${YOU[1] + 5} L${YOU[0] - 11} ${YOU[1] + 11} Z`} fill="#fff" transform={`rotate(-40 ${YOU[0]} ${YOU[1]})`} />
        </svg>
        {/* home pin */}
        <div style={{position: 'absolute', left: HOME[0] - 44, top: HOME[1] - 118, width: 88, height: 118}}>
          <svg width={88} height={118} viewBox="0 0 24 32" style={{filter: 'drop-shadow(0 5px 5px rgba(0,0,0,0.3))'}}>
            <path d="M12 31 C12 31 1.5 19 1.5 11.5 A10.5 10.5 0 0 1 22.5 11.5 C22.5 19 12 31 12 31 Z" fill="#E5392F" stroke="#A91E17" strokeWidth={0.8} />
            <circle cx={12} cy={11.5} r={6.2} fill="#fff" />
          </svg>
          <div style={{position: 'absolute', left: 25, top: 14}}>
            <HomeGlyph size={38} color="#E5392F" />
          </div>
        </div>
        {/* road label on the route */}
        <div
          style={{
            position: 'absolute',
            left: 590,
            top: 1000,
            transform: 'rotate(-50deg)',
            transformOrigin: '0 0',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 18px',
            borderRadius: 30,
            background: '#FFFFFF',
            boxShadow: '0 3px 10px rgba(0,0,0,0.25)',
            fontSize: 34,
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{background: '#1E7A3C', color: '#fff', borderRadius: 8, padding: '0 10px', fontSize: 26, fontFamily: UI_FONT, direction: 'ltr'}}>E 611</span>
          {COPY.maps.road}
        </div>
        {[
          {x: 610, y: 850},
          {x: 380, y: 610},
        ].map((p, i) => (
          <div key={i} style={{position: 'absolute', left: p.x - 30, top: p.y - 30, width: 60, height: 60, borderRadius: 30, background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <WarningIcon size={40} color="#E0342C" />
          </div>
        ))}
      </div>

      {/* trip card: the punchline, in the top band */}
      <div
        style={{
          position: 'absolute',
          top: 214,
          left: 36,
          width: 1008,
          height: 432,
          borderRadius: 44,
          background: '#FFFFFF',
          boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
          boxSizing: 'border-box',
          padding: '30px 48px',
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 16, fontSize: 40, fontWeight: 600, color: '#3C3A36'}}>
          <div style={{width: 64, height: 64, borderRadius: 32, background: '#FDE7E5', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <HomeGlyph size={38} color="#E5392F" />
          </div>
          <span>إلى {COPY.maps.to}</span>
          <span style={{color: '#9A968F', fontWeight: 500}}>· عبر {COPY.maps.road}</span>
        </div>
        <div style={{fontSize: 118, fontWeight: 700, color: '#C8211B', lineHeight: '150px', marginTop: 10, whiteSpace: 'nowrap'}}>
          <Mixed text={COPY.maps.eta} />
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 16, marginTop: 4}}>
          <div style={{width: 22, height: 22, borderRadius: 11, background: '#C8211B'}} />
          <span style={{fontSize: 44, fontWeight: 600, color: '#9C1812'}}>{COPY.maps.note}</span>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 14, fontSize: 36, fontWeight: 500, color: '#6F6A61', marginTop: 12}}>
          <CarIcon size={40} color="#6F6A61" />
          <Mixed text="38 كم · الوصول 19:19" />
        </div>
      </div>

      {/* map controls */}
      {[{y: 1420, I: LayersIcon}, {y: 1540, I: RecenterIcon}].map(({y, I}, i) => (
        <div key={i} style={{position: 'absolute', left: 40, top: y, width: 100, height: 100, borderRadius: 50, background: '#fff', boxShadow: '0 3px 10px rgba(0,0,0,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <I size={48} color="#3C3A36" />
        </div>
      ))}

      {/* bottom bar */}
      <div
        style={{
          position: 'absolute',
          top: 1672,
          left: 0,
          width: 1080,
          height: 260,
          borderRadius: '52px 52px 0 0',
          background: '#FFFFFF',
          boxShadow: '0 -6px 30px rgba(0,0,0,0.16)',
          boxSizing: 'border-box',
          padding: '34px 56px',
          display: 'flex',
          gap: 22,
        }}
      >
        <div style={{height: 104, padding: '0 64px', borderRadius: 52, background: '#1A5FD0', color: '#fff', fontSize: 42, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 14}}>
          <svg width={40} height={40} viewBox="0 0 24 24">
            <path d="M12 2 L20 21 L12 16.5 L4 21 Z" fill="#fff" />
          </svg>
          ابدأ
        </div>
        <div style={{height: 104, padding: '0 46px', borderRadius: 52, border: '3px solid #C9C5BD', color: '#1A5FD0', fontSize: 40, fontWeight: 600, display: 'flex', alignItems: 'center'}}>الخطوات</div>
        <div style={{height: 104, padding: '0 46px', borderRadius: 52, border: '3px solid #C9C5BD', color: '#1A5FD0', fontSize: 40, fontWeight: 600, display: 'flex', alignItems: 'center'}}>مشاركة</div>
      </div>
      <HomeBar dark={false} />
    </div>
  );
};
