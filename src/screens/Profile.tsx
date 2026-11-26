import { ReviewForm } from '../components/SocialProof';
import { PinSetupSheet } from '../components/PinLock';
import { ThemeToggle } from '../components/ThemeToggle';
import { clearPin, hasPin, setPin, verifyPin } from '../engine/applock';
import { TAB_MOTIONS, saveTabMotion, useTabMotion } from '../components/TabBar';
import { themePref, setThemePref, type ThemePref } from '../engine/theme';
import { useState } from 'react';
import { ACHIEVEMENTS, LEAGUES } from '../engine/game';
import { addDays, dayKey } from '../engine/time';
import { useStore } from '../state/store';
import { WeekStrip } from './Result';
import { AccountCard } from '../components/AccountCard';
import { Avatar, AvatarPicker } from '../components/Avatar';
import { useAccount } from '../state/account';

export function Profile({ onManageAiConsent }: { onManageAiConsent: () => void }) {
  const { state, update, reset } = useStore();
  const [confirmReset, setConfirmReset] = useState(false);
  const [name, setName] = useState(state.name);
  const [picking, setPicking] = useState(false);
  const { me } = useAccount();
  const words = Object.keys(state.words).length;
  const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
  const c = new Date(state.createdAt);
  const since = `${c.getFullYear()}-yil ${MONTHS[c.getMonth()]}`;

  // So'nggi 14 kun XP grafigi
  const today = dayKey();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const max = Math.max(state.dailyGoal, ...days.map((d) => state.xpByDay[d] ?? 0));

  return (
    <div className="page">
      <AccountCard />
      <div className="profile-head">
        <button type="button" className="avatar-big" onClick={() => setPicking(true)} aria-label="Avatarni o'zgartirish">
          <Avatar value={state.avatar} size={72} />
          <span className="avatar-edit">✎</span>
        </button>
        <div>
          <input className="name-input" value={name} placeholder="Ismingiz" onChange={(e) => setName(e.target.value)} onBlur={() => update((s) => ({ ...s, name: name.trim() }))} />
          <p className="muted">{since} dan beri · 🇺🇿 → 🇫🇷</p>
        </div>
      </div>

      {picking && <AvatarPicker value={state.avatar} googlePhoto={me.user?.avatar} onPick={(v) => update((s) => ({ ...s, avatar: v }))} onClose={() => setPicking(false)} />}

      {me.admin && (
        <a className="btn btn-ghost admin-link" href="#/admin">
          🧾 Admin: to'lov cheklari
        </a>
      )}

      <h2 className="section-title">Statistika</h2>
      <div className="stats-grid">
        <div className="scard">
          <span>☀️</span>
          <b>{state.streak}</b>
          <small>Kunlik seriya</small>
        </div>
        <div className="scard">
          <span>⭐</span>
          <b>{state.xp}</b>
          <small>Jami XP</small>
        </div>
        <div className="scard">
          <span>{LEAGUES[state.league.tier].icon}</span>
          <b>{LEAGUES[state.league.tier].name}</b>
          <small>Turnir ligasi</small>
        </div>
        <div className="scard">
          <span>📚</span>
          <b>{words}</b>
          <small>O'rganilgan so'z</small>
        </div>
        <div className="scard">
          <span>🏅</span>
          <b>{state.longestStreak}</b>
          <small>Eng uzun seriya</small>
        </div>
        <div className="scard">
          <span>💯</span>
          <b>{state.perfectLessons}</b>
          <small>Xatosiz dars</small>
        </div>
      </div>

      <h2 className="section-title">Shu hafta</h2>
      <WeekStrip />
      <div className="xp-chart" aria-label="So'nggi 14 kunlik XP">
        <div className="xp-bars">
          {days.map((d) => {
            const v = state.xpByDay[d] ?? 0;
            return (
              <div key={d} className="xp-col" title={`${d}: ${v} XP`}>
                <div className={`xp-bar ${v >= state.dailyGoal ? 'goal' : ''}`} style={{ height: `${(v / max) * 100}%` }} />
              </div>
            );
          })}
          <div className="xp-goal" style={{ bottom: `${(state.dailyGoal / max) * 100}%` }}>
            <span>maqsad {state.dailyGoal}</span>
          </div>
        </div>
        <div className="xp-labels">
          {days.map((d) => (
            <small key={d}>{Number(d.slice(8))}</small>
          ))}
        </div>
      </div>

      <h2 className="section-title">Yutuqlar</h2>
      <div className="ach-list">
        {ACHIEVEMENTS.map((a) => {
          const p = Math.min(a.goal, a.progress(state));
          const done = !!state.achievements[a.id];
          return (
            <div key={a.id} className={`ach ${done ? 'done' : ''}`}>
              <div className="ach-icon">{a.icon}</div>
              <div className="ach-body">
                <b>{a.title}</b>
                <small>{a.desc}</small>
                <div className="ach-bar">
                  <i style={{ width: `${(p / a.goal) * 100}%` }} />
                </div>
              </div>
              <span className="ach-count">
                {p}/{a.goal}
              </span>
            </div>
          );
        })}
      </div>

      <h2 className="section-title">Fikringiz</h2>
      <div className="panel rv-profile">
        <ReviewForm />
      </div>

      <h2 className="section-title">Sozlamalar</h2>
      <div className="panel">
        <b>🔐 Vivi AI va maxfiylik</b>
        <p className="muted small">Har bir AI vazifasiga rozilikni alohida boshqaring, uni bekor qiling yoki Vivi xotirasini o‘chiring.</p>
        <button type="button" className="btn btn-ghost" onClick={onManageAiConsent}>AI roziliklarini boshqarish</button>
      </div>
      <div className="settings">
        <ThemeSetting />
        <TabMotionSetting />
        <PinSetting />
        <label className="setting">
          <span>⚡ Yengil rejim (sekin telefonlar uchun)</span>
          <input
            type="checkbox"
            defaultChecked={document.documentElement.classList.contains('lite')}
            onChange={(e) => {
              document.documentElement.classList.toggle('lite', e.target.checked);
              try {
                localStorage.setItem('salut.lite', e.target.checked ? '1' : '0');
              } catch {
                /* e'tiborsiz */
              }
            }}
          />
        </label>
        <label className="setting">
          <span>🔈 Ovoz effektlari</span>
          <input type="checkbox" checked={state.settings.sound} onChange={(e) => update((s) => ({ ...s, settings: { ...s.settings, sound: e.target.checked } }))} />
        </label>
        <label className="setting">
          <span>🎧 Tinglash mashqlari</span>
          <input type="checkbox" checked={state.settings.listening} onChange={(e) => update((s) => ({ ...s, settings: { ...s.settings, listening: e.target.checked } }))} />
        </label>
        <label className="setting">
          <span>🗣️ Talaffuz tezligi</span>
          <input
            type="range"
            min={0.5}
            max={1.2}
            step={0.05}
            value={state.settings.ttsRate}
            onChange={(e) => update((s) => ({ ...s, settings: { ...s.settings, ttsRate: Number(e.target.value) } }))}
          />
        </label>
        <div className="setting">
          <span>🎯 Kunlik maqsad</span>
          <div className="seg">
            {[10, 20, 30, 50].map((g) => (
              <button key={g} type="button" className={state.dailyGoal === g ? 'on' : ''} onClick={() => update((s) => ({ ...s, dailyGoal: g }))}>
                {g}
              </button>
            ))}
          </div>
        </div>
      </div>
      <a className="btn btn-ghost btn-lg about-link" href="#/about">
        ℹ️ Biz haqimizda · ijtimoiy tarmoqlar · ulashish
      </a>
      <p className="legal-links">
        <a href="./privacy.html" target="_blank" rel="noreferrer">Maxfiylik siyosati</a> · <a href="./terms.html" target="_blank" rel="noreferrer">Foydalanish shartlari</a>
      </p>
      <button type="button" className="btn btn-text danger" onClick={() => setConfirmReset(true)}>
        Progressni o'chirish
      </button>
      {confirmReset && (
        <div className="modal-back" onClick={() => setConfirmReset(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="big-emoji">⚠️</div>
            <h3>Hamma progress o'chiriladi</h3>
            <p className="muted">Ball, seriya, so'zlar va yutuqlar qaytarib bo'lmaydigan tarzda o'chadi.</p>
            <button type="button" className="btn btn-danger btn-lg" onClick={reset}>
              Ha, o'chirish
            </button>
            <button type="button" className="btn btn-text" onClick={() => setConfirmReset(false)}>
              Bekor qilish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeSetting() {
  const [pref, setPref] = useState<ThemePref>(themePref());
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme !== 'light');
  const apply = (p: ThemePref) => {
    // Mavzu almashganda ranglar keskin emas, yumshoq o'tadi.
    const html = document.documentElement;
    html.classList.add('theme-anim');
    setPref(p);
    setThemePref(p);
    setDark(html.dataset.theme !== 'light');
    window.setTimeout(() => html.classList.remove('theme-anim'), 700);
  };
  return (
    <div className="setting theme-setting">
      <span>
        🎨 Ko'rinish
        <br />
        <small className="muted">{pref === 'auto' ? 'Avto — telefon sozlamasiga qarab' : dark ? 'Tungi rejim' : 'Kunduzgi rejim'}</small>
      </span>
      <div className="theme-controls">
        <ThemeToggle dark={dark} onToggle={(next) => apply(next ? 'dark' : 'light')} />
        <button type="button" className={`theme-auto ${pref === 'auto' ? 'on' : ''}`} aria-pressed={pref === 'auto'} onClick={() => apply('auto')}>
          🌗 Avto
        </button>
      </div>
    </div>
  );
}

/** Pastki menyu o'tish animatsiyasi (videodagi 6 uslub). Tanlansa — menyu darhol namoyish qiladi. */
function TabMotionSetting() {
  const current = useTabMotion();
  return (
    <div className="setting tab-motion-setting">
      <span>✨ Menyu animatsiyasi</span>
      <div className="tm-grid" role="radiogroup" aria-label="Menyu animatsiyasi">
        {TAB_MOTIONS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={current === m.id}
            className={`tm-chip tm-chip-${m.id} ${current === m.id ? 'on' : ''}`}
            onClick={() => saveTabMotion(m.id)}
          >
            <b>{m.name}</b>
            <small>{m.note}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Shaxsiy PIN: qo'yilsa, ilova ochilganda «OTP» uslubidagi qulf ekrani PIN so'raydi. */
function PinSetting() {
  const [on, setOn] = useState(hasPin);
  const [sheet, setSheet] = useState<null | 'set' | 'change' | 'off'>(null);
  const verifyCurrent = async (pin: string): Promise<true | string> => {
    const r = await verifyPin(pin);
    return r.ok ? true : r.waitMs ? `Juda ko'p urinish. ${Math.ceil(r.waitMs / 1000)} soniya kuting.` : "Noto'g'ri PIN.";
  };
  return (
    <div className="setting pin-setting">
      <span>
        🔒 Kirish paroli (PIN)
        <br />
        <small className="muted">{on ? 'Yoqilgan — ilova ochilganda PIN so‘raladi.' : 'O‘chiq. Shaxsiy 4 xonali PIN qo‘ying.'}</small>
      </span>
      {on ? (
        <span className="pin-actions">
          <button type="button" className="btn btn-ghost small" onClick={() => setSheet('change')}>O'zgartirish</button>
          <button type="button" className="btn btn-text small" onClick={() => setSheet('off')}>O'chirish</button>
        </span>
      ) : (
        <button type="button" className="btn btn-primary small" onClick={() => setSheet('set')}>PIN qo'yish</button>
      )}
      {sheet && (
        <PinSetupSheet
          mode={sheet}
          verifyCurrent={verifyCurrent}
          save={setPin}
          remove={clearPin}
          onClose={() => {
            setSheet(null);
            setOn(hasPin());
          }}
        />
      )}
    </div>
  );
}
