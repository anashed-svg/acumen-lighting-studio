// Generic dark Arabic keyboard with a suggestion strip.
import React from 'react';
import {UI_FONT} from '../theme';
import {DeleteKeyIcon, GlobeIcon, MicIcon} from './Icons';

export const KEYBOARD_H = 900;

const rows = [
  ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج'],
  ['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ط'],
  ['ذ', 'ء', 'ؤ', 'ر', 'ى', 'ة', 'و', 'ز', 'ظ', 'د'],
];

const keyStyle: React.CSSProperties = {
  height: 124,
  borderRadius: 16,
  background: '#48484C',
  boxShadow: '0 3px 0 rgba(0,0,0,0.45)',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 50,
  fontFamily: UI_FONT,
};

export const Keyboard: React.FC<{top: number; suggestions: string[]}> = ({top, suggestions}) => {
  const kw = 86;
  const gap = 12;
  return (
    <div style={{position: 'absolute', top, left: 0, width: 1080, height: KEYBOARD_H, background: '#1E1E21', direction: 'rtl', fontFamily: UI_FONT}}>
      <div style={{height: 104, display: 'flex', alignItems: 'center', justifyContent: 'space-around', color: '#E6E7EA', fontSize: 40}}>
        {suggestions.map((s, i) => (
          <React.Fragment key={i}>
            {i ? <div style={{width: 2, height: 52, background: 'rgba(255,255,255,0.18)'}} /> : null}
            <span style={{fontWeight: i === 1 ? 600 : 400}}>{s}</span>
          </React.Fragment>
        ))}
      </div>
      <div style={{padding: '8px 9px 0', display: 'flex', flexDirection: 'column', gap: 26}}>
        {rows.map((r, ri) => (
          <div key={ri} style={{display: 'flex', justifyContent: 'center', gap}}>
            {r.map((k) => (
              <div key={k} style={{...keyStyle, width: kw}}>
                {k}
              </div>
            ))}
            {ri === 2 ? (
              <div style={{...keyStyle, width: kw + 30, background: '#2E2E32'}}>
                <DeleteKeyIcon size={52} color="#fff" />
              </div>
            ) : null}
          </div>
        ))}
        <div style={{display: 'flex', gap, justifyContent: 'center'}}>
          <div style={{...keyStyle, width: 190, background: '#2E2E32', fontSize: 38, direction: 'ltr'}}>123</div>
          <div style={{...keyStyle, width: 110, background: '#2E2E32', fontSize: 50}}>🙂</div>
          <div style={{...keyStyle, width: 450, fontSize: 36, color: '#C9CACD'}}>مسافة</div>
          <div style={{...keyStyle, width: 250, background: '#2E2E32', fontSize: 36}}>إرسال</div>
        </div>
      </div>
      <div style={{position: 'absolute', bottom: 62, right: 60}}>
        <GlobeIcon size={60} color="#C9CACD" />
      </div>
      <div style={{position: 'absolute', bottom: 62, left: 60}}>
        <MicIcon size={60} color="#C9CACD" />
      </div>
    </div>
  );
};
