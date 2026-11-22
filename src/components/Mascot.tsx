// Vivi — ilovaning original maskoti: yoqimtoy parijlik mushukcha.
// Jonli (GIF kabi): ko'z pirpiratadi, dumini likillatadi, qulog'ini qimirlatadi (CSS, styles.css → .vivi-*).
export type Mood = 'happy' | 'sad' | 'cheer' | 'think' | 'sleep';

export const FUR = '#F7F3FF';
export const FUR_SHADE = '#DDD3FA';
export const LINE = '#4C3F8F';
export const INK = '#1E1B4B';
const EAR_IN = '#F9A8D4';
const CHEEK = '#F9A8D4';

/** Quloqlar (boshning yuqorisi, 200×200 koordinatada). */
export function CatEars({ fill = FUR }: { fill?: string }) {
  return (
    <g strokeLinejoin="round">
      <g className="vivi-ear-l">
        <path d="M44 70 L50 16 Q52 10 58 14 L92 44 Z" fill={fill} stroke={LINE} strokeWidth="4" />
        <path d="M54 56 L58 28 L80 46 Z" fill={EAR_IN} />
      </g>
      <g className="vivi-ear-r">
        <path d="M156 70 L150 16 Q148 10 142 14 L108 44 Z" fill={fill} stroke={LINE} strokeWidth="4" />
        <path d="M146 56 L142 28 L120 46 Z" fill={EAR_IN} />
      </g>
    </g>
  );
}

/** Burun va mo'ylovlar — har qanday shaklda Vivini tanitib turadi (yuz markaziga nisbatan). */
export function CatMuzzle({ x = 0, y = 0 }: { x?: number; y?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g stroke={LINE} strokeWidth="2.6" strokeLinecap="round" opacity=".75" className="vivi-whiskers">
        <path d="M-40 6 L-70 0" />
        <path d="M-40 13 L-71 15" />
        <path d="M40 6 L70 0" />
        <path d="M40 13 L71 15" />
      </g>
      <path d="M-6 6 Q0 1 6 6 Q0 13 -6 6 Z" fill="#F472B6" stroke="#DB2777" strokeWidth="1.5" strokeLinejoin="round" />
    </g>
  );
}

/** Tana, dum, panjalar va bosh (yuzsiz) — mushukchaning asosi. */
export function CatBase() {
  return (
    <g strokeLinejoin="round">
      {/* Dum */}
      <g className="vivi-tail">
        <path d="M138 164 C170 166 186 140 178 112 C175 102 164 104 166 114 C171 134 160 150 136 148 Z" fill={FUR} stroke={LINE} strokeWidth="4" />
        <path d="M178 112 C175 102 164 104 166 114 C167 118 168 121 168 124 C175 122 180 118 178 112 Z" fill="#A78BFA" />
      </g>
      {/* Tana */}
      <path d="M58 182 C50 150 64 124 100 124 C136 124 150 150 142 182 Z" fill={FUR} stroke={LINE} strokeWidth="4" />
      <path d="M82 182 C80 160 88 146 100 146 C112 146 120 160 118 182 Z" fill="#FFFFFF" opacity=".9" />
      {/* Panjalar */}
      <ellipse cx="80" cy="182" rx="15" ry="9" fill={FUR} stroke={LINE} strokeWidth="4" />
      <ellipse cx="120" cy="182" rx="15" ry="9" fill={FUR} stroke={LINE} strokeWidth="4" />
      <CatEars />
      {/* Bosh */}
      <ellipse cx="100" cy="92" rx="66" ry="56" fill={FUR} stroke={LINE} strokeWidth="4" />
      {/* Peshonadagi chiziqlar */}
      <g stroke="#C4B5FD" strokeWidth="4.5" strokeLinecap="round">
        <path d="M100 40 v12" />
        <path d="M86 42 l3 10" />
        <path d="M114 42 l-3 10" />
      </g>
    </g>
  );
}

export function Mascot({ mood = 'happy', size = 120, className = '' }: { mood?: Mood; size?: number; className?: string }) {
  const eyes =
    mood === 'sleep' ? (
      <g stroke={INK} strokeWidth="4.5" strokeLinecap="round" fill="none">
        <path d="M64 94 q10 7 20 0" />
        <path d="M116 94 q10 7 20 0" />
      </g>
    ) : mood === 'cheer' ? (
      <g stroke={INK} strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M64 98 q10 -13 20 0" />
        <path d="M116 98 q10 -13 20 0" />
      </g>
    ) : (
      <g className="vivi-eyes">
        <ellipse cx="74" cy="92" rx="12" ry={mood === 'sad' ? 11 : 14} fill={INK} />
        <ellipse cx="126" cy="92" rx="12" ry={mood === 'sad' ? 11 : 14} fill={INK} />
        <g className={mood === 'think' ? 'vivi-look-up' : ''}>
          <circle cx="78" cy="86" r="4.8" fill="#fff" />
          <circle cx="130" cy="86" r="4.8" fill="#fff" />
          <circle cx="70" cy="98" r="2.2" fill="#fff" opacity=".85" />
          <circle cx="122" cy="98" r="2.2" fill="#fff" opacity=".85" />
        </g>
        {mood === 'sad' && (
          <g stroke={INK} strokeWidth="3.5" strokeLinecap="round">
            <path d="M60 72 l18 6" />
            <path d="M140 72 l-18 6" />
          </g>
        )}
      </g>
    );
  const mouth =
    mood === 'sad' ? (
      <path d="M90 124 q10 -8 20 0" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />
    ) : mood === 'think' ? (
      <path d="M93 120 h14" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
    ) : mood === 'sleep' ? (
      <path d="M90 116 q5 5 10 0 q5 5 10 0" stroke={INK} strokeWidth="3.2" fill="none" strokeLinecap="round" />
    ) : mood === 'cheer' ? (
      <path d="M88 115 q12 20 24 0 z" fill="#BE185D" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
    ) : (
      <path d="M88 115 q6 7 12 0 q6 7 12 0" stroke={INK} strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    );
  return (
    <svg className={`mascot vivi mascot-${mood} ${className}`} width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="Vivi maskoti">
      <ellipse cx="100" cy="190" rx="62" ry="7" fill="rgba(0,0,0,.14)" />
      <g className="vivi-bob">
        <CatBase />
        {eyes}
        <ellipse cx="56" cy="112" rx="10" ry="6" fill={CHEEK} opacity=".55" />
        <ellipse cx="144" cy="112" rx="10" ry="6" fill={CHEEK} opacity=".55" />
        <CatMuzzle x={100} y={104} />
        {mouth}
      </g>
      {mood === 'cheer' && (
        <g fill="#FDE68A" className="vivi-sparkles">
          <path d="M18 44 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 z" />
          <path d="M180 26 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 z" />
          <path d="M184 150 l2.5 6 l6 2.5 l-6 2.5 l-2.5 6 l-2.5 -6 l-6 -2.5 l6 -2.5 z" />
        </g>
      )}
      {mood === 'sleep' && (
        <text x="150" y="40" fontSize="26" fontWeight="800" fill="#A5B4FC" fontFamily="Onest, sans-serif" className="vivi-z">
          z<tspan dy="-10" fontSize="20">z</tspan>
        </text>
      )}
    </svg>
  );
}
