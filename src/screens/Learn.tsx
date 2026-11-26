import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { COURSE, type Cefr, type Unit } from '../data/course';
import { buildPath, isLessonUnlocked, nodeState, spinWheel, type PathNode, type WheelPrize } from '../engine/game';
import { playSfx, speak } from '../engine/audio';
import { motionAllowed } from '../engine/motion';
import { useStore } from '../state/store';
import { Mascot } from '../components/Mascot';
import { AdSlot } from '../components/AdSlot';
import { Ic, type IconName } from '../components/Icons';
import { CoinIcon, FishIcon } from '../components/TopBarIcons';
import type { SessionConfig } from './Session';

// Darslar xaritasi — «Candy Crush» uslubida PASTDAN TEPAGA: 1-dars eng pastda, keyingilari yuqorida.
// Har bir bo'lim: ilon izi yo'l (nuqtali egri chiziq), yumaloq bekatlar, yulduzchalar; pastida binafsha sarlavha kartasi.
// Avvalgi «sovg'a bekati» o'rnida — Sirli quti.

const SP = 118; // bekatlar orasidagi vertikal masofa (px)
const WAVE = [0, 0.72, 1, 0.55, -0.2, -0.85, -1, -0.5];

export function Learn({ onStart }: { onStart: (c: SessionConfig) => void }) {
  const { state } = useStore();
  const [guide, setGuide] = useState<Unit | null>(null);
  const [sheet, setSheet] = useState<PathNode | null>(null);
  const [wheel, setWheel] = useState<PathNode | null>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const [peek, setPeek] = useState<Set<string>>(() => new Set());
  const firstLocked = COURSE.findIndex((u) => !isLessonUnlocked(state, u.lessons[0].id));

  // Ochilganda — hozirgi bekatga (yo'q bo'lsa — eng pastga, ya'ni boshiga).
  useLayoutEffect(() => {
    const go = () => {
      if (activeRef.current) activeRef.current.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
      else window.scrollTo(0, document.documentElement.scrollHeight);
    };
    go();
    // Ilova marshrut almashganda tepaga qaytaradi — keyingi kadrda yana joylaymiz.
    const r = requestAnimationFrame(() => requestAnimationFrame(go));
    return () => cancelAnimationFrame(r);
  }, []);

  const order = COURSE.map((u, ui) => ({ u, ui })).reverse();
  return (
    <div className="learn lmap">
      <div className="course-end">
        <Mascot mood="sleep" size={100} />
        <p className="muted">Voilà ! Siz C2 — eng yuqori darajaga yetdingiz. Félicitations !</p>
      </div>
      <AdSlot />
      {order.map(({ u, ui }) => {
        const locked = !isLessonUnlocked(state, u.lessons[0].id);
        const done = u.lessons.filter((l) => state.lessonsDone[l.id]).length;
        const lvl = u.level ?? 'A1';
        const levelStart = ui === 0 || (COURSE[ui - 1].level ?? 'A1') !== lvl;
        const far = locked && firstLocked >= 0 && ui > firstLocked + 1 && !peek.has(u.id);
        return (
          <section key={u.id} className={`lunit ${locked ? 'locked' : ''}`} style={{ ['--unit' as string]: u.color }}>
            {far ? (
              <button type="button" className="line-peek" onClick={() => setPeek((p) => new Set(p).add(u.id))}>
                <Ic name="lock" size={18} /> {`${u.lessons.length} ta dars — ko'rish`}
              </button>
            ) : (
              <PathMap nodes={buildPath(ui)} onOpen={setSheet} onWheel={setWheel} onStart={onStart} activeRef={activeRef} />
            )}
            <header className="lunit-card">
              <div className="lunit-text">
                <small>{`Liniya ${ui + 1}`}</small>
                <h2>{u.title}</h2>
                <p>{u.description}</p>
              </div>
              <div className="lunit-actions">
                <button type="button" className="lunit-btn" onClick={() => setGuide(u)} aria-label="Qo'llanma">
                  <Ic name="book" size={22} />
                </button>
                <button type="button" className="lunit-btn" onClick={() => (location.hash = '#/tutor')} aria-label="Vivi bilan gaplashish">
                  <Ic name="chat" size={22} />
                </button>
              </div>
              <div className="lunit-progress" aria-label={`${done} / ${u.lessons.length}`}>
                <span style={{ width: `${(done / u.lessons.length) * 100}%` }} />
                <b>
                  {done} / {u.lessons.length}
                </b>
              </div>
            </header>
            {levelStart && (
              <div className={`level-head lv-${lvl}`}>
                <span className="level-badge">{lvl}</span>
                <div>
                  <b>{LEVEL_NAMES[lvl]}</b>
                  <small>{`${COURSE.filter((x) => (x.level ?? 'A1') === lvl).length} ta liniya`}</small>
                </div>
                {locked && ui > 0 && (
                  <button type="button" className="btn btn-jump" onClick={() => onStart({ kind: 'jump', level: lvl })}>
                    <Ic name="bolt" size={16} /> {lvl} ga sakrash
                  </button>
                )}
              </div>
            )}
          </section>
        );
      })}
      {sheet && <NodeSheet node={sheet} onClose={() => setSheet(null)} onStart={onStart} />}
      {wheel && <BoxModal node={wheel} onClose={() => setWheel(null)} />}
      {guide && <GuideModal unit={guide} onClose={() => setGuide(null)} />}
    </div>
  );
}

const LEVEL_NAMES: Record<Cefr, string> = {
  A1: "Boshlang'ich",
  A2: 'Elementar',
  B1: "O'rta",
  B2: "O'rtadan yuqori",
  C1: "Ilg'or",
  C2: 'Mukammal',
};

/** Bitta bo'limning ilon izi xaritasi: pastdan tepaga, nuqtali egri yo'l, o'tilgan qismi rangli. */
function PathMap({
  nodes,
  onOpen,
  onWheel,
  onStart,
  activeRef,
}: {
  nodes: PathNode[];
  onOpen: (n: PathNode) => void;
  onWheel: (n: PathNode) => void;
  onStart: (c: SessionConfig) => void;
  activeRef: React.RefObject<HTMLButtonElement>;
}) {
  const { state } = useStore();
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(360);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    setW(el.clientWidth || 360);
    const ro = new ResizeObserver(() => setW(el.clientWidth || 360));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = (nodes.length - 1) * SP + 150;
  const amp = Math.min(w * 0.27, 118);
  const pts = nodes.map((_, i) => ({ x: w / 2 + WAVE[i % WAVE.length] * amp, y: H - 70 - i * SP }));
  const states = nodes.map((n) => nodeState(state, n));
  const reached = states.reduce((a, st, i) => (st !== 'locked' ? i : a), -1);
  const pathTo = (k: number) => {
    let d = `M${pts[0].x},${pts[0].y + 40}`;
    d += ` L${pts[0].x},${pts[0].y}`;
    for (let i = 1; i <= k && i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      d += ` C${a.x},${a.y - SP * 0.55} ${b.x},${b.y + SP * 0.55} ${b.x},${b.y}`;
    }
    return d;
  };

  return (
    <div className="lpath" ref={box} style={{ height: H }}>
      <svg className="lpath-svg" width={w} height={H} aria-hidden="true">
        <path d={pathTo(nodes.length - 1)} className="lpath-line rest" />
        {reached > 0 && <path d={pathTo(reached)} className="lpath-line done" />}
      </svg>
      {nodes.map((n, i) => {
        const st = states[i];
        const p = pts[i];
        const times = n.type === 'lesson' ? state.lessonsDone[n.id] ?? 0 : 0;
        const stars = n.type === 'lesson' ? Math.min(3, times) : n.type === 'review' && st === 'done' ? 3 : 0;
        const isNext = st === 'active' && n.type === 'lesson';
        const icon: IconName = n.type === 'lesson' ? LESSON_ICONS[(n.unitIndex + n.lessonIndex) % LESSON_ICONS.length] : n.type === 'review' ? 'trophy' : 'gift';
        const title = n.type === 'lesson' ? n.title : n.type === 'review' ? 'Yakuniy takrorlash' : 'Sirli quti';
        const side = WAVE[i % WAVE.length] >= 0 ? 'left' : 'right';
        return (
          <div key={n.id} className={`lnode ${st} t-${n.type} ${isNext ? 'next' : ''}`} style={{ left: p.x, top: p.y, ['--i' as string]: i } as CSSProperties}>
            <button
              type="button"
              className="lnode-btn"
              ref={isNext ? activeRef : undefined}
              onClick={() => (n.type === 'chest' && st === 'active' ? onWheel(n) : onOpen(n))}
              aria-label={title}
            >
              <span className="lnode-face">{st === 'locked' ? <Ic name="lock" size={28} className="lnode-lock" /> : n.type === 'chest' ? <Ic name="gift" size={20} /> : <Ic name={icon} size={n.type === 'review' ? 38 : 32} />}</span>
            </button>
            {n.type !== 'chest' && (
              <span className="lnode-stars" aria-label={`${stars} yulduz`}>
                {[0, 1, 2].map((k) => (
                  <i key={k} className={k < stars ? 'on' : ''}>
                    ★
                  </i>
                ))}
              </span>
            )}
            <span className="lnode-title">{title}</span>
            {isNext && (
              <div className={`lnode-here ${side}`}>
                <span className="lnode-vivi">
                  <Mascot mood="happy" size={58} />
                </span>
                <button type="button" className="lnode-go" onClick={() => onStart({ kind: 'lesson', lessonId: n.id })}>
                  Davom etish
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NodeSheet({ node, onClose, onStart }: { node: PathNode; onClose: () => void; onStart: (c: SessionConfig) => void }) {
  const { state } = useStore();
  const st = nodeState(state, node);
  const unit = COURSE[node.unitIndex];
  const times = node.type === 'lesson' ? state.lessonsDone[node.id] ?? 0 : 0;
  return createPortal(
    <div className="modal-back" onClick={onClose}>
      <div className="sheet lsheet" onClick={(e) => e.stopPropagation()} style={{ ['--unit' as string]: unit.color }}>
        {node.type === 'lesson' && (
          <>
            <span className="lsheet-badge">{`${node.lessonIndex + 1}-dars`}</span>
            <h3>{node.title}</h3>
            {st === 'locked' ? (
              <p className="muted">Bu bekatga yetish uchun oldingi darslarni tugating.</p>
            ) : (
              <>
                {times > 0 && <p className="muted">{`O'tilgan · ${times} marta — takrorlab yulduz yig'ing`}</p>}
                <div className="pop-words">
                  {unit.lessons[node.lessonIndex].words.map((w) => (
                    <button key={w.fr} type="button" onClick={() => speak(w.fr, state.settings.ttsRate)}>
                      <Ic name="speaker" size={15} /> {w.fr}
                    </button>
                  ))}
                </div>
                <button type="button" className="btn btn-primary btn-lg" onClick={() => onStart({ kind: 'lesson', lessonId: node.id })}>
                  {st === 'done' ? 'Takrorlash · +10 XP' : 'Darsni boshlash · +10 XP'}
                </button>
              </>
            )}
          </>
        )}
        {node.type === 'review' && (
          <>
            <span className="lsheet-badge"><Ic name="trophy" size={22} /></span>
            <h3>Yakuniy takrorlash</h3>
            <p className="muted">{st === 'locked' ? 'Avval liniyadagi barcha darslarni tugating.' : "Bo'limdagi hamma so'z va gaplarni mustahkamlang."}</p>
            {st !== 'locked' && (
              <button type="button" className="btn btn-primary btn-lg" onClick={() => onStart({ kind: 'review', unitIndex: node.unitIndex })}>
                Takrorlashni boshlash · +15 XP
              </button>
            )}
          </>
        )}
        {node.type === 'chest' && (
          <>
            <span className="lsheet-badge"><Ic name="gift" size={22} /></span>
            <h3>Sirli quti</h3>
            <p className="muted">{st === 'done' ? 'Bu quti allaqachon ochilgan.' : "Qutini ochish uchun oldingi bekatlardan o'ting."}</p>
          </>
        )}
        <button type="button" className="btn btn-text" onClick={onClose}>
          Yopish
        </button>
      </div>
    </div>,
    document.body,
  );
}

const PRIZE_FACE: Record<WheelPrize['kind'], { icon: React.ReactNode }> = {
  gems: { icon: <CoinIcon /> },
  fish: { icon: <FishIcon /> },
  boost: { icon: <Ic name="bolt" size={26} /> },
  freeze: { icon: <Ic name="shield" size={26} /> },
};
const LESSON_ICONS: IconName[] = ['chat', 'book', 'headphones', 'pencil', 'mic', 'letters', 'puzzle', 'speaker'];
const prizeText = (p: WheelPrize) =>
  p.kind === 'gems' ? `+${p.amount} tanga` : p.kind === 'fish' ? `+${p.amount} baliqcha` : p.kind === 'boost' ? `2x XP · ${p.minutes} daqiqa` : '+1 seriya soyaboni';

/** Oltin sirli quti (SVG): korpus va qopqoq alohida — qopqoq ochilishda uchib ketadi. */
function GoldBox() {
  return (
    <svg className="gbox" viewBox="0 0 160 150" aria-hidden="true">
      <defs>
        <linearGradient id="gb-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE7A3" />
          <stop offset="1" stopColor="#E9A93A" />
        </linearGradient>
        <linearGradient id="gb-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#F7C966" />
          <stop offset="1" stopColor="#D08A22" />
        </linearGradient>
        <linearGradient id="gb-gem" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFD23F" />
          <stop offset=".55" stopColor="#FF6B9A" />
          <stop offset="1" stopColor="#9B5CFF" />
        </linearGradient>
      </defs>
      <ellipse cx="80" cy="140" rx="56" ry="7" fill="rgba(0,0,0,.25)" />
      <g className="gbox-body">
        <path d="M22 62h116v66a10 10 0 0 1-10 10H32a10 10 0 0 1-10-10z" fill="url(#gb-body)" />
        <path d="M22 62h116v12H22z" fill="#C98320" opacity=".35" />
        <path d="M70 62h20v76H70z" fill="url(#gb-side)" opacity=".9" />
        <path d="M80 82l16 16-16 16-16-16z" fill="url(#gb-gem)" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M80 86l5 5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity=".8" />
      </g>
      <g className="gbox-lid">
        <path d="M14 44a8 8 0 0 1 8-8h116a8 8 0 0 1 8 8v14a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6z" fill="url(#gb-body)" />
        <path d="M68 36h24v28H68z" fill="url(#gb-side)" />
        <path d="M80 36c-10-20-34-22-34-10 0 9 18 10 34 10zM80 36c10-20 34-22 34-10 0 9-18 10-34 10z" fill="none" stroke="#FFF3CF" strokeWidth="5" strokeLinejoin="round" />
        <path d="M20 40h120" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".55" />
      </g>
    </svg>
  );
}

const SPARKS = Array.from({ length: 18 }, (_, i) => {
  const a = (i / 18) * Math.PI * 2;
  const d = 90 + (i % 3) * 26;
  return { x: Math.round(Math.cos(a) * d), y: Math.round(Math.sin(a) * d - 30), d: (i % 6) * 40, s: 4 + (i % 4) * 2 };
});

/** Sirli quti: bosiladi → silkinadi → qopqoq otilib chiqadi, nurlar va uchqunlar → sovg'a ko'tariladi. Faqat transform/opacity. */
function BoxModal({ node, onClose }: { node: PathNode; onClose: () => void }) {
  const { state, update } = useStore();
  const [stage, setStage] = useState<'idle' | 'shake' | 'open'>('idle');
  const [result, setResult] = useState<WheelPrize | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const open = () => {
    if (stage !== 'idle') return;
    const r = spinWheel(state, node.id, Math.random());
    const fast = !motionAllowed();
    setStage('shake');
    if (navigator.vibrate) navigator.vibrate([10, 60, 10, 60, 10]);
    timers.current.push(
      window.setTimeout(() => {
        update(() => r.state);
        setResult(r.prize);
        setStage('open');
        playSfx('chest', state.settings.sound);
        if (navigator.vibrate) navigator.vibrate([25, 40, 40]);
      }, fast ? 30 : 750),
    );
  };

  return createPortal(
    <div className="modal-back box-back" onClick={() => stage !== 'shake' && onClose()}>
      <div className={`sheet box-sheet bx-${stage}`} onClick={(e) => e.stopPropagation()}>
        <small className="box-kicker">{result ? 'SOVG\'A OCHILDI' : 'SIRLI QUTI'}</small>
        <div className="box-stage" onClick={open}>
          <span className="box-rays" aria-hidden="true" />
          <span className="box-glow" aria-hidden="true" />
          <span className="box-sparks" aria-hidden="true">
            {SPARKS.map((p, k) => (
              <i key={k} style={{ ['--x' as string]: `${p.x}px`, ['--y' as string]: `${p.y}px`, ['--d' as string]: `${p.d}ms`, width: p.s, height: p.s }} />
            ))}
          </span>
          {result && <span className="box-prize">{PRIZE_FACE[result.kind].icon}</span>}
          <GoldBox />
        </div>
        {result ? (
          <div className="box-result">
            <b>{prizeText(result)}</b>
            <button type="button" className="btn btn-primary btn-lg" onClick={onClose}>
              Merci !
            </button>
          </div>
        ) : (
          <>
            <p className="muted">Ichida — tanga, baliqcha, 2x XP yoki seriya soyaboni.</p>
            <button type="button" className="btn btn-primary btn-lg btn-beam" onClick={open} disabled={stage !== 'idle'}>
              {stage === 'idle' ? 'Qutini ochish' : 'Ochilmoqda…'}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function GuideModal({ unit, onClose }: { unit: Unit; onClose: () => void }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="sheet guide" onClick={(e) => e.stopPropagation()} style={{ ['--unit' as string]: unit.color }}>
        <div className="guide-head">
          <h3><Ic name="book" size={22} /> {unit.title}: qo'llanma</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Yopish">
            <Ic name="close" size={18} />
          </button>
        </div>
        <div className="guide-body">
          {unit.guide.map((g) => (
            <div key={g.title} className="guide-card">
              <h4>{g.title}</h4>
              <p>{g.text}</p>
              {g.examples && (
                <ul>
                  {g.examples.map(([fr, uz]) => (
                    <li key={fr}>
                      <button type="button" className="ex-fr" onClick={() => speak(fr)}>
                        <Ic name="speaker" size={16} /> {fr}
                      </button>
                      <span>{uz}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <h4 className="vocab-h">Lug'at</h4>
          <div className="vocab-grid">
            {unit.lessons
              .flatMap((l) => l.words)
              .map((w) => (
                <button key={w.fr + w.uz} type="button" className="vocab" onClick={() => speak(w.fr)}>
                  <b>{w.fr}</b>
                  <small>{w.uz}</small>
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
