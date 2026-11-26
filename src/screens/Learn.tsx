import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { COURSE, type Cefr, type Unit } from '../data/course';
import { buildPath, isLessonUnlocked, nodeState, spinWheel, wheelPrizes, type PathNode, type WheelPrize } from '../engine/game';
import { playSfx, speak } from '../engine/audio';
import { motionAllowed } from '../engine/motion';
import { useStore } from '../state/store';
import { Mascot } from '../components/Mascot';
import { AdSlot } from '../components/AdSlot';
import type { SessionConfig } from './Session';

// Darslar xaritasi — «Candy Crush» uslubida PASTDAN TEPAGA: 1-dars eng pastda, keyingilari yuqorida.
// Har bir bo'lim: ilon izi yo'l (nuqtali egri chiziq), yumaloq bekatlar, yulduzchalar; pastida binafsha sarlavha kartasi.
// Avvalgi «sovg'a bekati» o'rnida — Omad g'ildiragi.

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
                {`🔒 ${u.lessons.length} ta dars — ko'rish`}
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
                  📘
                </button>
                <button type="button" className="lunit-btn" onClick={() => (location.hash = '#/tutor')} aria-label="Vivi bilan gaplashish">
                  💬
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
                    ⚡ {lvl} ga sakrash
                  </button>
                )}
              </div>
            )}
          </section>
        );
      })}
      {sheet && <NodeSheet node={sheet} onClose={() => setSheet(null)} onStart={onStart} />}
      {wheel && <WheelModal node={wheel} onClose={() => setWheel(null)} />}
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
        const unit = COURSE[n.unitIndex];
        const emoji = n.type === 'lesson' ? unit.lessons[n.lessonIndex].words[0]?.emoji ?? '📘' : n.type === 'review' ? '🏆' : '🎡';
        const title = n.type === 'lesson' ? n.title : n.type === 'review' ? 'Yakuniy takrorlash' : "Omad g'ildiragi";
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
              <span className="lnode-face">{st === 'locked' ? <span className="lnode-lock">🔒</span> : emoji}</span>
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
                {times > 0 && <p className="muted">{`O'tilgan · ${times} marta — takrorlab yulduz yig'ing ⭐`}</p>}
                <div className="pop-words">
                  {unit.lessons[node.lessonIndex].words.map((w) => (
                    <button key={w.fr} type="button" onClick={() => speak(w.fr, state.settings.ttsRate)}>
                      {w.emoji} {w.fr}
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
            <span className="lsheet-badge">🏆</span>
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
            <span className="lsheet-badge">🎡</span>
            <h3>Omad g'ildiragi</h3>
            <p className="muted">{st === 'done' ? "Bu g'ildirak allaqachon aylantirilgan." : "G'ildirakni aylantirish uchun oldingi bekatlardan o'ting."}</p>
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

const PRIZE_FACE: Record<WheelPrize['kind'], { icon: string; color: string }> = {
  gems: { icon: '🪙', color: '#FFD23F' },
  fish: { icon: '🐟', color: '#7FE3FF' },
  boost: { icon: '⚡', color: '#9B5CFF' },
  freeze: { icon: '⛱️', color: '#FF6B9A' },
};
const prizeText = (p: WheelPrize) =>
  p.kind === 'gems' ? `+${p.amount} tanga` : p.kind === 'fish' ? `+${p.amount} baliqcha` : p.kind === 'boost' ? `2x XP · ${p.minutes} daqiqa` : '+1 seriya soyaboni';

/** Omad g'ildiragi: 6 sektor; mukofot avval tanlanadi, g'ildirak o'sha sektorga to'xtaydi. */
function WheelModal({ node, onClose }: { node: PathNode; onClose: () => void }) {
  const { state, update } = useStore();
  const prizes = wheelPrizes(node.id);
  const [angle, setAngle] = useState(0);
  const [result, setResult] = useState<WheelPrize | null>(null);
  const [spinning, setSpinning] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const seg = 360 / prizes.length;

  const spin = () => {
    if (spinning || result) return;
    const r = spinWheel(state, node.id, Math.random());
    const target = 360 * 6 - (r.index * seg + seg / 2);
    setSpinning(true);
    setAngle(target);
    const ms = motionAllowed() ? 3800 : 50;
    timer.current = window.setTimeout(() => {
      update(() => r.state);
      setResult(r.prize);
      setSpinning(false);
      playSfx('chest', state.settings.sound);
      if (navigator.vibrate) navigator.vibrate([20, 40, 30]);
    }, ms);
  };

  // Sektorlar (conic-gradient) — soat yo'nalishida 12 dan
  const conic = prizes.map((p, i) => `${PRIZE_FACE[p.kind].color} ${i * seg}deg ${(i + 1) * seg}deg`).join(', ');
  return createPortal(
    <div className="modal-back wheel-back" onClick={() => !spinning && onClose()}>
      <div className="sheet wheel-sheet" onClick={(e) => e.stopPropagation()}>
        <h3>Omad g'ildiragi</h3>
        <p className="muted">Aylantiring — tanga, baliqcha, 2x XP yoki soyabon yutib oling!</p>
        <div className="wheel-stage">
          <span className="wheel-pointer" aria-hidden="true" />
          <div className="wheel" style={{ background: `conic-gradient(${conic})`, transform: `rotate(${angle}deg)` }}>
            {prizes.map((p, i) => (
              <span key={i} className="wheel-label" style={{ transform: `rotate(${i * seg + seg / 2}deg)` }}>
                <b>{PRIZE_FACE[p.kind].icon}</b>
                <small>{p.kind === 'gems' || p.kind === 'fish' ? `+${p.amount}` : p.kind === 'boost' ? '2x' : '+1'}</small>
              </span>
            ))}
          </div>
          <button type="button" className="wheel-hub" onClick={spin} disabled={spinning || !!result}>
            {spinning ? '…' : result ? '✓' : 'Aylantir'}
          </button>
        </div>
        {result ? (
          <div className="wheel-result">
            <span>{PRIZE_FACE[result.kind].icon}</span>
            <b>{prizeText(result)}</b>
            <button type="button" className="btn btn-primary btn-lg" onClick={onClose}>
              Merci !
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-primary btn-lg btn-beam" onClick={spin} disabled={spinning}>
            {spinning ? 'Aylanmoqda…' : "🎡 G'ildirakni aylantirish"}
          </button>
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
          <h3>📘 {unit.title}: qo'llanma</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Yopish">
            ✕
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
                        🔊 {fr}
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
                  <span>{w.emoji}</span>
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
