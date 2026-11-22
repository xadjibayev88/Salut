// Chatdagi yashil fransuzcha ibora: bosilganda o'qiladi va ustida o'zbekcha tarjimasi chiqadi.
// Avval kurs lug'atidan qidiriladi, topilmasa — serverdan (Gemini) so'raladi va keshlanadi.
import { useEffect, useRef, useState } from 'react';
import { ALL_LESSONS } from '../data/course';
import { speak, ttsSupported } from '../engine/audio';

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[«»"“”!?.,;:…()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

let dict: Map<string, string> | null = null;
function local(text: string): string | null {
  if (!dict) {
    dict = new Map();
    for (const l of ALL_LESSONS) for (const w of l.words) dict.set(norm(w.fr), w.uz);
  }
  const k = norm(text);
  return dict.get(k) ?? dict.get(k.replace(/^(le|la|les|l'|un|une|des) /, '')) ?? null;
}

const CACHE_KEY = 'salut.tr.v1';
const cache: Record<string, { uz: string; say?: string }> = (() => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
})();
function remember(k: string, v: { uz: string; say?: string }) {
  cache[k] = v;
  try {
    const keys = Object.keys(cache);
    if (keys.length > 400) for (const old of keys.slice(0, keys.length - 400)) delete cache[old];
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* saqlanmasa ham bo'ladi */
  }
}

async function translate(text: string, context: string): Promise<{ uz: string; say?: string } | null> {
  const k = norm(text);
  if (cache[k]) return cache[k];
  const l = local(text);
  if (l) return { uz: l };
  try {
    const r = await fetch('./api/translate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, context }) });
    if (!r.ok) return null;
    const j = (await r.json()) as { uz?: string; say?: string };
    if (!j.uz) return null;
    remember(k, { uz: j.uz, say: j.say });
    return { uz: j.uz, say: j.say };
  } catch {
    return null;
  }
}

export function FrChip({ text, context, rate }: { text: string; context: string; rate: number }) {
  const [open, setOpen] = useState(false);
  const [below, setBelow] = useState(false);
  const [tr, setTr] = useState<{ uz: string; say?: string } | null | 'loading' | 'error'>(null);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const t = setTimeout(() => setOpen(false), 6000);
    document.addEventListener('pointerdown', close);
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', close);
    };
  }, [open]);

  const tap = async () => {
    speak(text, rate);
    // Chat tepasiga yaqin bo'lsa — pufak pastda chiqadi (kesilib qolmasin).
    const chat = ref.current?.closest('.chat')?.getBoundingClientRect();
    const me = ref.current?.getBoundingClientRect();
    setBelow(!!chat && !!me && me.top - chat.top < 90);
    setOpen((o) => !o);
    if (tr && tr !== 'error') return;
    setTr('loading');
    const r = await translate(text, context);
    setTr(r ?? 'error');
  };

  return (
    <span className="fr-chip-wrap" ref={ref}>
      <button type="button" className={`fr-chip ${open ? 'open' : ''}`} onClick={() => void tap()} title="Tarjima va talaffuz">
        {text}
        {ttsSupported() && <span className="fr-chip-icon">🔊</span>}
      </button>
      {open && (
        <span className={`fr-pop ${below ? 'below' : ''}`} role="tooltip">
          {tr === 'loading' || tr === null ? (
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
          ) : tr === 'error' ? (
            <span className="muted">Tarjima topilmadi</span>
          ) : (
            <>
              <b>{tr.uz}</b>
              {tr.say && <small>[{tr.say}]</small>}
            </>
          )}
        </span>
      )}
    </span>
  );
}
