import { ALL_LESSONS } from '../data/course';
import { wordRecall } from '../engine/game';
import { speak, ttsSupported } from '../engine/audio';
import { useStore } from '../state/store';
import { Mascot } from '../components/Mascot';
import type { SessionConfig } from './Session';
import { SwipeRow, UndoStrip } from '../components/SwipeRow';
import { useCallback, useState, type ReactNode } from 'react';

export function Practice({ onStart }: { onStart: (c: SessionConfig) => void }) {
  const { state, update } = useStore();
  const learned = [
    ...ALL_LESSONS.filter((l) => state.lessonsDone[l.id]).flatMap((l) => l.words),
    ...state.customWords.map((w) => ({ fr: w.fr, uz: w.uz, emoji: '📝' as string | undefined })),
  ];
  const mistakes = Object.keys(state.mistakes).length;
  const now = Date.now();
  const rows = learned
    .map((w) => ({ w, r: state.words[w.fr] ? wordRecall(state.words[w.fr], now) : 0 }))
    .sort((a, b) => a.r - b.r);
  const disabled = learned.length === 0;

  // O'chirilgan so'z «Qaytarish» uchun asl joyi bilan eslab qolinadi (Inline Undo).
  type Custom = (typeof state.customWords)[number];
  const [removed, setRemoved] = useState<{ word: Custom; index: number; pos: number } | null>(null);
  const clearRemoved = useCallback(() => setRemoved(null), []);
  const removeWord = (fr: string, pos: number) => {
    const index = state.customWords.findIndex((x) => x.fr.toLowerCase() === fr.toLowerCase());
    if (index < 0) return;
    setRemoved({ word: state.customWords[index], index, pos });
    update((s) => ({ ...s, customWords: s.customWords.filter((x) => x.fr.toLowerCase() !== fr.toLowerCase()) }));
  };
  const undoRemove = () => {
    if (!removed) return;
    const { word, index } = removed;
    update((s) => {
      if (s.customWords.some((x) => x.fr.toLowerCase() === word.fr.toLowerCase())) return s;
      const next = [...s.customWords];
      next.splice(Math.min(index, next.length), 0, word);
      return { ...s, customWords: next };
    });
    setRemoved(null);
  };
  const firstRemovable = rows.findIndex(({ w }) => w.emoji === '📝');
  const undo = removed ? <UndoStrip key={removed.word.fr} label={removed.word.fr} onUndo={undoRemove} onExpire={clearRemoved} /> : null;

  return (
    <div className="page">
      <h1 className="page-title">Mashq</h1>
      {disabled && (
        <div className="empty">
          <Mascot mood="think" size={120} />
          <p>Mashq qilish uchun avval kamida bitta darsni tugating.</p>
        </div>
      )}
      <div className="practice-grid">
        <button type="button" className="pcard" style={{ ['--c' as string]: '#2B3A9B' }} disabled={disabled} onClick={() => onStart({ kind: 'practice', mode: 'smart' })}>
          <span className="pcard-icon">🧠</span>
          <b>Aqlli takrorlash</b>
          <small>Unutilayotgan so'zlarni mustahkamlang · +1 ☕</small>
        </button>
        <button type="button" className="pcard" style={{ ['--c' as string]: '#E5484D' }} disabled={disabled || mistakes === 0} onClick={() => onStart({ kind: 'practice', mode: 'mistakes' })}>
          <span className="pcard-icon">🩹</span>
          <b>Xatolar ustida ishlash</b>
          <small>{mistakes ? `${mistakes} ta xato kutmoqda` : "Hozircha xato yo'q"}</small>
        </button>
        <button
          type="button"
          className="pcard"
          style={{ ['--c' as string]: '#8B5CF6' }}
          disabled={disabled || !ttsSupported()}
          onClick={() => onStart({ kind: 'practice', mode: 'listening' })}
        >
          <span className="pcard-icon">🎧</span>
          <b>Tinglash mashqi</b>
          <small>{ttsSupported() ? 'Quloqni fransuz nutqiga o\'rgating' : 'Brauzeringiz ovozni qo\'llamaydi'}</small>
        </button>
      </div>

      {rows.length > 0 && (
        <>
          <h2 className="section-title">
            So'zlarim <span className="muted">· {rows.length}</span>
          </h2>
          <div className="word-list">
            {rows.map(({ w, r }, i) => {
              const removable = w.emoji === '📝';
              const content = (
                <div role="button" tabIndex={0} className="word-row" onClick={() => speak(w.fr, state.settings.ttsRate)}>
                  <span className="wr-emoji">{w.emoji}</span>
                  <span className="wr-text">
                    <b>{w.fr}</b>
                    <small>{w.uz}</small>
                  </span>
                  <span className="strength" title={`${Math.round(r * 100)}%`}>
                    {[0, 1, 2, 3].map((k) => (
                      <i key={k} className={r > k * 0.25 + 0.05 ? 'on' : ''} />
                    ))}
                  </span>
                  {removable && (
                    <button
                      type="button"
                      className="wr-remove"
                      aria-label={`${w.fr} — lug'atdan chiqarish`}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeWord(w.fr, i);
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
              const node: ReactNode = removable ? (
                <SwipeRow key={w.fr + w.uz} hint={i === firstRemovable} onDelete={() => removeWord(w.fr, i)}>
                  {content}
                </SwipeRow>
              ) : (
                <div key={w.fr + w.uz}>{content}</div>
              );
              return removed && removed.pos === i ? [undo, node] : node;
            })}
            {removed && removed.pos >= rows.length && undo}
          </div>
        </>
      )}
    </div>
  );
}
