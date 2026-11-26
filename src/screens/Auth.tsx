// Kirish / ro'yxatdan o'tish: Google, email + parol, yoki mehmon sifatida davom etish.
import { grantAllAiConsent } from '../state/ai-consent';
import { useEffect, useRef, useState } from 'react';
import { useAccount } from '../state/account';
import { SocialLogin } from '../components/SocialLogin';
import { motionAllowed } from '../engine/motion';

type GoogleId = {
  initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string; auto_select?: boolean; itp_support?: boolean }) => void;
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
};
type AndroidAuth = { googleSignIn: (requestId: string, clientId: string) => void };
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
    AndroidAuth?: AndroidAuth;
    __salutAuthResolve?: (id: string, token: string) => void;
    __salutAuthReject?: (id: string, message: string) => void;
  }
}

let gisPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  gisPromise ??= new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisPromise = null;
      reject(new Error('gis'));
    };
    document.head.appendChild(s);
  });
  return gisPromise;
}

/** Android ilovada: telefondagi Google hisobidan (Credential Manager) ID token. */
function androidGoogle(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const id = String(Date.now());
    window.__salutAuthResolve = (rid, token) => rid === id && resolve(token);
    window.__salutAuthReject = (rid, message) => rid === id && reject(new Error(message));
    window.AndroidAuth!.googleSignIn(id, clientId);
  });
}

type Phase = 'idle' | 'out' | 'core' | 'in';
// Morf vaqtlari (ms): forma yo'qoladi → bo'laklar markazda birlashib aylanadi → yangi forma ochiladi.
const OUT_MS = 340;
const CORE_MS = 640;
const IN_MS = 460;

const Icon = {
  user: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="3.6" /><path d="M4.8 20c.9-3.6 3.7-5.6 7.2-5.6s6.3 2 7.2 5.6" /></svg>,
  mail: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="m4.5 7 7.5 6 7.5-6" /></svg>,
  lock: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></svg>,
  eye: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></svg>,
  eyeOff: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 3l18 18M10.6 5.6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3.2 3.9M6.4 6.9C3.9 8.6 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1" /></svg>,
  arrow: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
};

export function AuthScreen({ initial = 'register', onDone, onSkip, title, backdrop = false }: { initial?: 'login' | 'register'; onDone: () => void; onSkip?: () => void; title?: string; backdrop?: boolean }) {
  const { me, signIn, signInGoogle } = useAccount();
  // Ro'yxatdan o'tishda: Vivi AI va maxfiylik shartlariga bitta toggle bilan rozilik (majburiy).
  const [agree, setAgree] = useState(false);
  const agreeRef = useRef(false);
  agreeRef.current = agree;
  const modeRef = useRef(initial);
  const [mode, setMode] = useState(initial);
  const [phase, setPhase] = useState<Phase>('idle');
  const [height, setHeight] = useState<number | null>(null);
  const [showPass, setShowPass] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /** Glassy morph: forma xiralashib yo'qoladi, karta kvadratga siqiladi, bo'laklar birlashadi, so'ng yangi forma ochiladi. */
  const switchMode = () => {
    const next = mode === 'register' ? 'login' : 'register';
    setError(null);
    const el = card.current;
    if (!el || !motionAllowed() || phase !== 'idle') {
      if (phase === 'idle') setMode(next);
      return;
    }
    const h0 = el.offsetHeight;
    const square = Math.min(h0, Math.round(el.offsetWidth * 0.86));
    setHeight(h0);
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    requestAnimationFrame(() => {
      setPhase('out');
      setHeight(square);
    });
    at(OUT_MS, () => {
      setPhase('core');
      setMode(next);
    });
    at(OUT_MS + CORE_MS, () => {
      setPhase('in');
      setHeight(content.current?.offsetHeight ?? null);
    });
    at(OUT_MS + CORE_MS + IN_MS, () => {
      setPhase('idle');
      setHeight(null);
    });
  };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gBtn = useRef<HTMLDivElement>(null);
  const clientId = me.googleClientId;
  const native = !!window.AndroidAuth;

  useEffect(() => {
    if (!clientId || native) return;
    let alive = true;
    loadGis()
      .then(() => {
        if (!alive || !gBtn.current || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          itp_support: true,
          callback: async (r) => {
            setBusy(true);
            const err = await signInGoogle(r.credential);
            setBusy(false);
            if (err) setError(err);
            else finish();
          },
        });
        window.google.accounts.id.renderButton(gBtn.current, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', width: Math.min(360, gBtn.current.clientWidth || 320), locale: 'uz' });
      })
      .catch(() => alive && setError("Google bilan kirish yuklanmadi — email orqali kiring"));
    return () => {
      alive = false;
    };
  }, [clientId, native]); // eslint-disable-line react-hooks/exhaustive-deps

  modeRef.current = mode;
  const finish = () => {
    if (modeRef.current === 'register' && agreeRef.current) void grantAllAiConsent().catch(() => undefined);
    onDone();
  };

  const nativeGoogle = async () => {
    if (!clientId) return;
    setBusy(true);
    setError(null);
    try {
      const token = await androidGoogle(clientId);
      const err = await signInGoogle(token);
      if (err) setError(err);
      else finish();
    } catch (e) {
      if (!/cancel/i.test(String((e as Error).message))) setError('Google bilan kirib bo\'lmadi — email orqali urinib ko\'ring');
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (mode === 'register' && !agree) {
      setBusy(false);
      setError("Ro'yxatdan o'tish uchun Vivi AI va maxfiylik shartlariga rozilik bering.");
      return;
    }
    const err = await signIn(mode, email, password, name);
    setBusy(false);
    if (err) setError(err);
    else finish();
  };

  const login = mode === 'login';
  const hasSocial = !!(clientId || me.auth?.facebookAppId || me.auth?.appleClientId || me.auth?.telegramBot);
  return (
    <div className={`auth glassy-auth ${backdrop ? 'with-backdrop' : ''}`}>
      {backdrop && (
        <div className="ga-backdrop" aria-hidden="true">
          <i /><i /><i /><i />
        </div>
      )}
      <div className={`ga-shell ga-${phase}`}>
      {/* Plitka, bo'laklar va halqalar kartadan tashqarida — kartaning qiya kesimi ularni qirqmasin. */}
      <span className="ga-chip" aria-hidden="true" />
      <span className="ga-piece tl" aria-hidden="true" />
      <span className="ga-piece br" aria-hidden="true" />
      <span className="ga-rings" aria-hidden="true"><i /><i /><i /></span>
      <div ref={card} className="ga-card" style={height === null ? undefined : { height }}>
        <div ref={content} className="ga-content" aria-busy={phase !== 'idle'}>
          <header className="ga-head">
            <h1>
              {title ?? (login ? <>Xush <span>kelibsiz</span></> : <>Profil <span>yarating</span></>)}
            </h1>
            <p>{login ? "Hisobingizga kiring va o'qishni davom ettiring." : 'Progressingiz saqlanadi va istalgan qurilmada davom etasiz.'}</p>
          </header>

          {!login && (
            <label className={`ga-consent ${agree ? 'on' : ''}`}>
              <span>
                <b>Vivi AI va maxfiylik shartlariga roziman</b>
                <small>Vivi bilan suhbat, ovoz, tarjima va xotira uchun matn/audio Google Gemini'ga yuboriladi. Profil → «Vivi AI va maxfiylik»da istalgan payt o'zgartirasiz.</small>
              </span>
              <input type="checkbox" checked={agree} onChange={(e) => { setAgree(e.target.checked); setError(null); }} />
            </label>
          )}
          {hasSocial && (
            <div className={`ga-social ${!login && !agree ? 'ga-locked' : ''}`} aria-disabled={!login && !agree}>
              {clientId &&
                (native ? (
                  <button type="button" className="ga-social-btn" disabled={busy} onClick={nativeGoogle}>
                    <span className="g-logo">G</span> Google
                  </button>
                ) : (
                  <div className="ga-slot gis-wrap" ref={gBtn} />
                ))}
              <SocialLogin onDone={finish} onError={setError} />
            </div>
          )}
          {hasSocial && <div className="ga-or"><span>yoki email bilan</span></div>}

          <form onSubmit={submit} className="ga-form">
            {!login && (
              <label className="ga-field">
                <span className="ga-label">Ismingiz</span>
                <span className="ga-input">
                  {Icon.user}
                  <input placeholder="Ali" autoComplete="given-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
                </span>
              </label>
            )}
            <label className="ga-field">
              <span className="ga-label">Email manzil</span>
              <span className="ga-input">
                {Icon.mail}
                <input type="email" placeholder="ism@pochta.uz" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </span>
            </label>
            <label className="ga-field">
              <span className="ga-label">Parol</span>
              <span className="ga-input">
                {Icon.lock}
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder={login ? '••••••••' : 'Kamida 8 ta belgi'}
                  autoComplete={login ? 'current-password' : 'new-password'}
                  required
                  minLength={login ? 1 : 8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" className="ga-eye" aria-label={showPass ? 'Parolni yashirish' : "Parolni ko'rsatish"} onClick={() => setShowPass((v) => !v)}>
                  {showPass ? Icon.eyeOff : Icon.eye}
                </button>
              </span>
            </label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button type="submit" className="ga-submit" disabled={busy || (!login && !agree)}>
              {busy ? 'Kuting…' : login ? 'Kirish' : 'Profil yaratish'} {!busy && Icon.arrow}
            </button>
          </form>

          <p className="ga-switch">
            {login ? "Hisobingiz yo'qmi?" : 'Hisobingiz bormi?'}{' '}
            <button type="button" onClick={switchMode} disabled={phase !== 'idle'}>
              {login ? 'Profil yaratish' : 'Kirish'}
            </button>
          </p>
          {onSkip && (
            <button type="button" className="btn btn-text muted-btn" onClick={onSkip}>
              Keyinroq
            </button>
          )}
        </div>
      </div>
      </div>
      <p className="auth-legal">
        Davom etish orqali siz{' '}
        <a href="./terms.html" target="_blank" rel="noreferrer">
          foydalanish shartlari
        </a>{' '}
        va{' '}
        <a href="./privacy.html" target="_blank" rel="noreferrer">
          maxfiylik siyosati
        </a>
        ga rozilik bildirasiz.
      </p>
    </div>
  );
}
