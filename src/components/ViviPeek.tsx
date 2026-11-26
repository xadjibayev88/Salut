// Vivi «mo'ralovchi»: matn maydoni ustida o'tirgan kichik Vivi boshchasi.
// idle — vaqti-vaqti bilan ko'z qisadi; typing — har tugmada sakraydi va ko'zlari yozuv bo'ylab yuradi;
// thinking — Vivi javob tayyorlayotganda «tomchi»dek chayqaladi, atrofida nuqtalar aylanadi.
// Faqat transform/opacity — sekin telefonlarda ham silliq.
import type { CSSProperties } from 'react';

export type PeekMode = 'idle' | 'typing' | 'thinking' | 'happy';

export function ViviPeek({ mode, len = 0, className = '' }: { mode: PeekMode; len?: number; className?: string }) {
  // Ko'zlar matn uzunligiga qarab chapdan o'ngga siljiydi (yozuvni «o'qiydi»).
  const look = mode === 'typing' ? Math.min(1, len / 36) * 6 - 3 : 0;
  return (
    <span className={`vpeek vp-${mode} ${className}`} aria-hidden="true" style={{ '--look': `${look}px` } as CSSProperties}>
      <span className="vpeek-hop" key={mode === 'typing' ? len : -1}>
        <svg viewBox="0 0 64 52" width="52" height="42">
          <defs>
            <linearGradient id="vpeek-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#7FE3FF" />
              <stop offset=".5" stopColor="#B49CFF" />
              <stop offset="1" stopColor="#FF8FD0" />
            </linearGradient>
          </defs>
          <g className="vpeek-body">
            <path d="M10 22 7 4l15 9M54 22l3-18-15 9" fill="url(#vpeek-g)" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
            <path d="M32 10c15 0 26 9 26 22 0 11-6 20-26 20S6 43 6 32c0-13 11-22 26-22z" fill="url(#vpeek-g)" stroke="#fff" strokeWidth="2" />
            <path d="M13 18c3-4 8-6 12-6" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".55" />
          </g>
          <g className="vpeek-eyes">
            <ellipse cx="24" cy="31" rx="3.6" ry="5.2" fill="#fff" />
            <ellipse cx="40" cy="31" rx="3.6" ry="5.2" fill="#fff" />
          </g>
          <path className="vpeek-mouth" d="M29 40q3 3 6 0" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      <span className="vpeek-dots">
        <i />
        <i />
        <i />
      </span>
    </span>
  );
}
