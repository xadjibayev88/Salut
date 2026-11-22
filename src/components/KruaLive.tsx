// Jonli Vivi (mushukcha): ovozli suhbatda shaklini o'zgartiradigan, imo-ishora qiladigan maskot.
// Shakl ([[shape:..]]) keyingi replikagacha saqlanadi, imo-ishora ([[do:..]]) bir marta ijro etiladi.
import { useEffect, useState, type CSSProperties } from 'react';
import type { Action, Shape } from '../engine/voice/markers';
import { CatBase, CatEars, CatMuzzle, FUR, INK } from './Mascot';
import { playSfx } from '../engine/audio';

export type LiveState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'sleeping';

const COLORS: Record<Shape, string> = {
  pill: FUR,
  circle: '#3B82F6',
  tall: '#4F46E5',
  puddle: '#0EA5A4',
  star: '#F5B400',
  heart: '#EC4899',
  drop: '#38BDF8',
  bubble: '#8B5CF6',
  cloud: '#60A5FA',
  book: '#2563EB',
  pencil: '#EAB308',
  headphones: '#7C3AED',
  bulb: '#F59E0B',
  card: '#FF6B57',
  slab: '#475569',
};

// Har bir shakl uchun tana (viewBox 0 0 200 200) va yuz joylashuvi.
const BODIES: Record<Exclude<Shape, 'pill'>, { d: string; face: [number, number]; scale?: number }> = {
  circle: { d: 'M100 38a66 66 0 1 1 0 132a66 66 0 1 1 0-132z', face: [100, 104] },
  tall: { d: 'M62 52q0-30 38-30t38 30v104q0 30-38 30t-38-30z', face: [100, 92] },
  puddle: { d: 'M18 150q4-36 82-36t82 36q-2 22-82 22t-82-22z', face: [100, 142], scale: 0.8 },
  star: { d: 'M100 22l22 50l54 5l-41 36l12 53l-47-28l-47 28l12-53l-41-36l54-5z', face: [100, 104], scale: 0.8 },
  heart: { d: 'M100 172C40 132 22 104 22 76c0-26 20-44 42-44c16 0 28 8 36 20c8-12 20-20 36-20c22 0 42 18 42 44c0 28-18 56-78 96z', face: [100, 92] },
  drop: { d: 'M100 22C120 58 160 90 160 124a60 60 0 1 1-120 0C40 90 80 58 100 22z', face: [100, 128] },
  bubble: { d: 'M30 40h140q14 0 14 14v74q0 14-14 14H92l-34 26v-26H30q-14 0-14-14V54q0-14 14-14z', face: [100, 92] },
  cloud: { d: 'M58 150q-36 0-36-30q0-28 30-32q4-34 40-36q26 0 36 22q8-6 20-6q30 0 32 30q24 4 24 26q0 26-30 26z', face: [104, 112] },
  book: { d: 'M100 56q-34-18-80-14v112q46-4 80 14q34-18 80-14V42q-46-4-80 14zM100 56v112', face: [100, 104], scale: 0.85 },
  pencil: { d: 'M60 30h80v112l-40 40l-40-40z', face: [100, 86] },
  headphones: { d: 'M100 52a52 52 0 1 1 0 104a52 52 0 1 1 0-104zM34 104q0-74 66-74t66 74', face: [100, 106], scale: 0.9 },
  bulb: { d: 'M100 24a58 58 0 0 1 34 106v18H66v-18A58 58 0 0 1 100 24zM72 158h56v12q0 12-12 12H84q-12 0-12-12z', face: [100, 84], scale: 0.9 },
  card: { d: 'M44 34h86l26 26v106q0 10-10 10H44q-10 0-10-10V44q0-10 10-10z', face: [96, 104] },
  slab: { d: 'M42 42h116q14 0 14 14v88q0 14-14 14H42q-14 0-14-14V56q0-14 14-14z', face: [100, 100] },
};

function Face({ x, y, s = 1, shape, state, level }: { x: number; y: number; s?: number; shape: Shape; state: LiveState; level: number }) {
  const sad = shape === 'puddle' || shape === 'drop';
  const love = shape === 'heart';
  const confused = shape === 'cloud';
  const cheer = shape === 'star';
  const look = state === 'thinking' ? -4 : 0;
  const mouthOpen = state === 'speaking' ? 3 + level * 12 : 0;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {state === 'sleeping' ? (
        <g stroke="#2B1A10" strokeWidth="5" strokeLinecap="round" fill="none">
          <path d="M-30 -6q8 6 16 0" />
          <path d="M14 -6q8 6 16 0" />
        </g>
      ) : cheer ? (
        <g stroke="#2B1A10" strokeWidth="5" strokeLinecap="round" fill="none">
          <path d="M-30 -2q8-12 16 0" />
          <path d="M14 -2q8-12 16 0" />
        </g>
      ) : love ? (
        <g fill="#2B1A10">
          <path d="M-22 -14c-6-6-14 0-8 7l8 8l8-8c6-7-2-13-8-7z" />
          <path d="M22 -14c-6-6-14 0-8 7l8 8l8-8c6-7-2-13-8-7z" />
        </g>
      ) : (
        <g>
          <ellipse className="vivi-eye" cx="-26" cy="-8" rx="12" ry={sad ? 11 : 14} fill={INK} />
          <ellipse className="vivi-eye" cx="26" cy="-8" rx="12" ry={sad ? 11 : 14} fill={INK} />
          <circle className="krua-pupil" cx="-22" cy={-14 + look} r="4.8" fill="#fff" />
          <circle className="krua-pupil" cx="30" cy={-14 + look} r="4.8" fill="#fff" />
          <circle cx="-30" cy="-2" r="2.2" fill="#fff" opacity=".85" />
          <circle cx="22" cy="-2" r="2.2" fill="#fff" opacity=".85" />
          {sad && (
            <g stroke="#2B1A10" strokeWidth="3.5" strokeLinecap="round">
              <path d="M-34 -22l14 5" />
              <path d="M34 -22l-14 5" />
            </g>
          )}
        </g>
      )}
      {confused ? (
        <path d="M-12 22q6-6 12 0t12 0" stroke="#2B1A10" strokeWidth="4" fill="none" strokeLinecap="round" />
      ) : sad ? (
        <path d="M-12 24q12-10 24 0" stroke="#2B1A10" strokeWidth="4" fill="none" strokeLinecap="round" />
      ) : mouthOpen > 1 ? (
        <ellipse cx="0" cy="23" rx="8" ry={mouthOpen} fill="#BE185D" stroke="#2B1A10" strokeWidth="2.5" />
      ) : (
        <path d="M-12 17q6 7 12 0q6 7 12 0" stroke="#2B1A10" strokeWidth="3.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      )}
      <CatMuzzle x={0} y={4} />
      {sad && state !== 'sleeping' && (
        <g fill="#7DD3FC" className="krua-tears">
          <path d="M-30 4q-4 8 0 12q4-4 0-12z" />
          <path d="M30 4q-4 8 0 12q4-4 0-12z" />
        </g>
      )}
      <ellipse cx="-44" cy="12" rx="9" ry="5" fill="#F9A8D4" opacity=".55" />
      <ellipse cx="44" cy="12" rx="9" ry="5" fill="#F9A8D4" opacity=".55" />
    </g>
  );
}

export function KruaLive({
  shape = 'pill',
  action,
  actionKey = 0,
  state = 'idle',
  level = 0,
  size = 240,
  pressed = false,
  fx = null,
  fxKey = 0,
  sound = true,
}: {
  /** Tana effekti: yashil bulut yoki pufak. */
  fx?: 'fart' | 'burp' | null;
  fxKey?: number;
  sound?: boolean;
  shape?: Shape;
  action?: Action | null;
  /** Har yangi imo-ishorada o'zgaradi — animatsiya qayta boshlanadi. */
  actionKey?: number;
  state?: LiveState;
  level?: number;
  size?: number;
  pressed?: boolean;
}) {
  const [flare, setFlare] = useState(false);
  useEffect(() => {
    if (action !== 'flare' && action !== 'flip') return;
    setFlare(true);
    // «flip» — o'rta barmoq: g'azabdan alangalanadi va zarba tovushi eshitiladi.
    if (action === 'flip' && sound) playSfx('hit');
    const t = setTimeout(() => setFlare(false), action === 'flip' ? 2200 : 1800);
    return () => clearTimeout(t);
  }, [action, actionKey, sound]);
  const [fxOn, setFxOn] = useState<typeof fx>(null);
  useEffect(() => {
    if (!fx) return;
    setFxOn(fx);
    if (sound && fx === 'fart') playSfx('fart');
    if (sound && fx === 'burp') playSfx('pop');
    const t = setTimeout(() => setFxOn(null), 2600);
    return () => clearTimeout(t);
  }, [fx, fxKey, sound]);

  const color = COLORS[shape];
  const body = shape === 'pill' ? null : BODIES[shape];
  const style = {
    '--krua-color': flare ? '#E0485A' : color,
    '--krua-level': String(state === 'speaking' ? level : state === 'listening' ? level : 0),
    width: size,
    height: size,
  } as CSSProperties;

  return (
    <div className={`krua-live st-${state} ${pressed ? 'pressed' : ''} ${flare ? 'flaring' : ''}`} style={style}>
      <div className="krua-glow" />
      <div key={`${action}-${actionKey}`} className={`krua-act ${action ? `act-${action}` : ''}`}>
        <div key={shape} className="krua-morph">
          <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={`Vivi: ${shape}`} className="vivi">
            <ellipse cx="100" cy="186" rx="58" ry="7" fill="rgba(0,0,0,.10)" />
            {body ? (
              <>
                {/* Mushuk quloqlari — har qanday shaklda Vivi tanilib turadi */}
                <g transform={`translate(${body.face[0] - 100} ${Math.min(40, Math.max(-14, body.face[1] - 112))})`}>
                  <CatEars fill={color} />
                </g>
                <path d={body.d} fill={color} stroke="rgba(0,0,0,.18)" strokeWidth="4" strokeLinejoin="round" fillRule="evenodd" />
              </>
            ) : (
              <CatBase />
            )}
            <Face x={body ? body.face[0] : 100} y={body ? body.face[1] : 100} s={body?.scale ?? 1} shape={shape} state={state} level={level} />
            {flare && (
              <g className="krua-flame">
                <path d="M100 6c10 16 26 18 22 38c10-6 10-18 8-24c14 12 18 30 6 44H64c-12-14-8-32 6-44c-2 6-2 18 8 24c-4-20 12-22 22-38z" fill="#FF6B2C" />
                <path d="M100 30c6 10 16 12 12 26H88c-4-14 6-16 12-26z" fill="#FFD43B" />
              </g>
            )}
          </svg>
        </div>
      </div>
      {action === 'flip' && (
        <svg key={`flip-${actionKey}`} className="vivi-flip" viewBox="0 0 120 140" aria-hidden="true">
          {/* Mushuk panjasi, o'rta barmoq ko'tarilgan (multfilm uslubida) */}
          <g stroke="#4C3F8F" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" fill="#F7F3FF">
            <path d="M28 134 C20 104 24 84 34 76 L86 76 C96 84 100 104 92 134 Z" />
            <rect x="48" y="8" width="24" height="74" rx="12" />
            <path d="M32 80 C26 68 30 58 40 58 C48 58 50 66 50 76" />
            <path d="M70 76 C70 64 74 58 82 58 C92 58 94 68 88 80" />
            <path d="M86 78 C94 70 104 74 102 84 C100 92 92 96 86 96" />
          </g>
          <ellipse cx="60" cy="22" rx="6" ry="4" fill="#F9A8D4" />
        </svg>
      )}
      {fxOn === 'fart' && (
        <div key={`fart-${fxKey}`} className="vivi-fart" aria-hidden="true">
          <i /><i /><i /><i />
        </div>
      )}
      {fxOn === 'burp' && (
        <div key={`burp-${fxKey}`} className="vivi-burp" aria-hidden="true">
          <i />
        </div>
      )}
      {state === 'thinking' && (
        <div className="krua-thinking">
          <i />
          <i />
          <i />
        </div>
      )}
    </div>
  );
}
