// Swipe Actions — «Liquid Delete» + «Inline Undo» + «Peek Hint»:
//  • qatorni chapga sursangiz, o'ng chetdan qizil «suyuq tomchi» cho'zilib chiqadi;
//  • yetarli surilsa — qator uzilib, tomchi «pop» qiladi va o'rnida «Qaytarish» tasmasi qoladi;
//  • ro'yxat birinchi marta ochilganda birinchi qator chapga ikki marta «ko'z qisib» imkoniyatni ko'rsatadi.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motionAllowed } from '../engine/motion';

const DELETE_AT = 0.38; // qator kengligining 38% i
export const UNDO_MS = 4500;
const HINT_KEY = 'voila.swipeHintSeen';

/** Surish masofasi → tomchi o'lchami (0..1). */
export function blobAmount(dx: number, width: number): number {
  if (dx >= 0 || width <= 0) return 0;
  return Math.min(1, -dx / (width * DELETE_AT));
}

export function SwipeRow({
  children,
  onDelete,
  hint = false,
}: {
  children: ReactNode;
  /** Qator uzilib chiqib ketgandan keyin chaqiriladi (ro'yxat «Qaytarish» tasmasini ko'rsatadi). */
  onDelete: () => void;
  /** Peek Hint ko'rsatish (odatda ro'yxatning birinchi o'chiriladigan qatori). */
  hint?: boolean;
}) {
  const row = useRef<HTMLDivElement>(null);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<'idle' | 'leaving'>('idle');
  const start = useRef<{ x: number; y: number; id: number; locked: boolean | null } | null>(null);
  const width = () => row.current?.offsetWidth ?? 320;

  // Peek Hint — qurilmada bir marta.
  useEffect(() => {
    if (!hint || !motionAllowed()) return;
    let seen = false;
    try {
      seen = localStorage.getItem(HINT_KEY) === '1';
    } catch {
      /* bloklangan */
    }
    if (seen) return;
    const t = setTimeout(() => {
      row.current?.classList.add('peek');
      try {
        localStorage.setItem(HINT_KEY, '1');
      } catch {
        /* bloklangan */
      }
    }, 900);
    return () => clearTimeout(t);
  }, [hint]);

  const commit = () => {
    setState('leaving');
    setDx(-width() * 1.2);
    if (navigator.vibrate) navigator.vibrate([6, 30, 12]);
    setTimeout(onDelete, motionAllowed() ? 340 : 0);
  };

  const amount = blobAmount(dx, width());
  return (
    <div className={`swipe-wrap ${state} ${amount >= 1 ? 'armed' : ''}`} style={{ ['--blob' as string]: amount, ['--dx' as string]: `${Math.min(0, dx)}px` }}>
      <div className="swipe-goo" aria-hidden="true">
        <span className="goo-blob" />
        <span className="goo-drop" />
        <span className="goo-icon">🗑️</span>
      </div>
      <div
        ref={row}
        className={`swipe-row ${dragging ? 'dragging' : ''}`}
        style={{ transform: `translateX(${dx}px)` }}
        onAnimationEnd={(e) => e.currentTarget.classList.remove('peek')}
        onPointerDown={(e) => {
          if (state !== 'idle' || e.pointerType === 'mouse' && e.button !== 0) return;
          start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, locked: null };
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s || s.id !== e.pointerId) return;
          const mx = e.clientX - s.x;
          const my = e.clientY - s.y;
          if (s.locked === null) {
            if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
            s.locked = Math.abs(mx) > Math.abs(my) * 1.3; // gorizontal — surish; vertikal — skroll
            if (s.locked) {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              setDragging(true);
            } else {
              start.current = null;
              return;
            }
          }
          if (!s.locked) return;
          setDx(mx < 0 ? mx : mx * 0.15);
        }}
        onPointerUp={() => {
          const s = start.current;
          start.current = null;
          if (!s?.locked) return;
          setDragging(false);
          if (blobAmount(dx, width()) >= 1) commit();
          else setDx(0);
        }}
        onPointerCancel={() => {
          start.current = null;
          setDragging(false);
          setDx(0);
        }}
        onClickCapture={(e) => {
          // Surishdan keyingi «click» qatorni bosish deb hisoblanmasin.
          if (Math.abs(dx) > 4) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Inline Undo — o'chirilgan qator o'rnida qoladigan tasma; vaqt tugaguncha «Qaytarish» mumkin. */
export function UndoStrip({ label, onUndo, onExpire }: { label: string; onUndo: () => void; onExpire: () => void }) {
  useEffect(() => {
    const t = setTimeout(onExpire, UNDO_MS);
    return () => clearTimeout(t);
  }, [onExpire]);
  return (
    <div className="swipe-undo" role="status">
      <span className="undo-timer" aria-hidden="true" />
      <span>🗑️ «{label}» o'chirildi</span>
      <button type="button" onClick={onUndo}>
        Qaytarish
      </button>
    </div>
  );
}
