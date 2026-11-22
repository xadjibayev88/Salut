import { SuperBanner, SuperOfferModal } from '../../components/SuperOffer';
// Vivi ovozli suhbati: tanishuv → xarakter va rol tanlash → qo'ng'iroq → tahlil.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CHARACTERS, CUSTOM_ROLE_MAX, CUSTOM_ROLE_MIN, EXPLAIN_LANGS, ROLES } from '../../data/characters';
import { applyChatTurn } from '../../engine/game';
import { learnerContext, updateMemory } from '../../engine/tutor';
import type { CallOptions, VoiceCall, VoiceConfig } from '../../engine/voice/call';
import { loadHistory, loadPrefs, restUntil, savePrefs, setRestUntil, type SessionRecord, type VoicePrefs } from '../../engine/voice/prefs';
import { browserSttSupported, cloudSttSupported } from '../../engine/voice/stt';
import { TtsQueue, browserVoiceAvailable } from '../../engine/voice/tts';
import { useStore } from '../../state/store';
import { KruaLive } from '../../components/KruaLive';
import { LiveCallScreen } from './LiveCall';
import { VoiceCallScreen } from './VoiceCall';
import { FeedbackView } from './FeedbackView';

const FALLBACK_CONFIG: VoiceConfig = { ai: false, stt: false, tts: 'browser', audioTags: false, voices: [], sessionMinutes: 10, cooldownMinutes: 20 };

function useVoiceConfig(refresh = 0): VoiceConfig | null {
  const [cfg, setCfg] = useState<VoiceConfig | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('./api/voice/config')
      .then((r) => (r.ok ? r.json() : FALLBACK_CONFIG))
      .catch(() => FALLBACK_CONFIG)
      .then((c: VoiceConfig) => alive && setCfg(c));
    return () => {
      alive = false;
    };
  }, [refresh]);
  return cfg;
}

const fmtLeft = (ms: number) => {
  const m = Math.ceil(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)} soat ${m % 60} daqiqa` : `${m} daqiqa`;
};

type View = { kind: 'hub' } | { kind: 'call'; key: number } | { kind: 'live'; key: number } | { kind: 'feedback'; record: SessionRecord };

export function VoiceHub() {
  const { state, update } = useStore();
  const [cfgRefresh, setCfgRefresh] = useState(0);
  const config = useVoiceConfig(cfgRefresh);
  const [prefs, setPrefsState] = useState<VoicePrefs>(loadPrefs);
  const [view, setView] = useState<View>({ kind: 'hub' });
  const [history, setHistory] = useState<SessionRecord[]>(loadHistory);
  const [consentFor, setConsentFor] = useState<string | null>(null);
  // Super taklifi: bepul foydalanuvchilarga kuniga bir marta kirganda, va bepul suhbat tugaganda.
  const [offer, setOffer] = useState<null | 'enter' | 'limit'>(null);
  const isFree = !!config && config.premium === false;
  useEffect(() => {
    if (!isFree) return;
    const key = 'voila.superOffer.day';
    const today = new Date().toISOString().slice(0, 10);
    try {
      if (localStorage.getItem(key) === today) return;
      localStorage.setItem(key, today);
    } catch {
      /* xotira yopiq */
    }
    const t = setTimeout(() => setOffer('enter'), 700);
    return () => clearTimeout(t);
  }, [isFree]);
  const [showHelp, setShowHelp] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [now, setNow] = useState(Date.now());
  const rest = restUntil();

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const setPrefs = (p: Partial<VoicePrefs>) =>
    setPrefsState((old) => {
      const n = { ...old, ...p };
      savePrefs(n);
      return n;
    });

  const role = ROLES.find((r) => r.id === prefs.role) ?? ROLES[0];
  const ch = CHARACTERS.find((c) => c.id === prefs.character) ?? CHARACTERS[0];
  const micLang = prefs.micLang !== 'auto' ? prefs.micLang : prefs.lang === 'uz' ? role.micLang : role.micLang === 'fr-FR' ? 'fr-FR' : EXPLAIN_LANGS.find((l) => l.id === prefs.lang)!.mic;
  const customOk = prefs.role !== 'custom' || prefs.customRole.trim().length >= CUSTOM_ROLE_MIN;
  // Super (yoki admin) — dam olish kutilmaydi, hatto oldin bepul rejimda belgilangan bo'lsa ham.
  const liveMode = !!(prefs.live && config?.live);
  // Jonli rejimda dam olish taymeri emas, jonli daqiqalar qoldig'i hal qiladi.
  const resting = rest > now && !config?.premium && !liveMode;
  const liveOut = liveMode && !config?.premium && (config?.liveMinutes ?? 0) < 1;
  const canTalk = !!config?.ai && (browserSttSupported() || (config.stt && cloudSttSupported()));

  const options: CallOptions | null = useMemo(
    () =>
      config
        ? {
            character: prefs.character,
            role: prefs.role,
            customRole: prefs.customRole.trim(),
            explicit: prefs.explicit && prefs.adultConfirmed,
            lang: prefs.lang,
            voiceId: prefs.voiceId,
            inputMode: prefs.inputMode,
            stt: prefs.stt,
            micLang,
            autoMic: prefs.micLang === 'auto',
            rate: prefs.rate,
            name: state.name,
            context: () => learnerContext(state),
            config,
          }
        : null,
    [config, prefs, micLang, state],
  );

  const onUserTurn = useCallback(() => update((s) => applyChatTurn(s).state), [update]);

  const onEnded = useCallback(
    (c: { snap: { endReason: VoiceCall['snap']['endReason']; error: unknown }; record: () => SessionRecord }) => {
      const rec = c.record();
      const talked = rec.turns.filter((t) => t.role === 'user').length > 0;
      const wasLive = rec.id.startsWith('live-');
      // Bepul: kunlik sessiya ishlatildi — qanday tugaganidan qat'i nazar (keyingisi ertaga). Super: faqat limitda.
      // Jonli rejimning o'z daqiqalari bor (server hisoblaydi) — u oddiy rejimni bloklamaydi.
      if (!wasLive && config && config.cooldownMinutes > 0 && (c.snap.endReason === 'limit' || (talked && !config.premium))) setRestUntil(Date.now() + config.cooldownMinutes * 60_000);
      if (wasLive) setCfgRefresh((n) => n + 1);
      if (config && !config.premium && (c.snap.endReason === 'limit' || talked)) setTimeout(() => setOffer('limit'), 900);
      // Xotirani yangilash (fon rejimida).
      if (talked)
        void updateMemory(state.memory ?? '', rec.turns.map((t) => ({ role: t.role, text: t.text })), state.name).then((m) => m && update((s) => ({ ...s, memory: m })));
      if (c.snap.error || rec.turns.filter((t) => t.role === 'user').length === 0) {
        setView({ kind: 'hub' });
        return;
      }
      setView({ kind: 'feedback', record: rec });
    },
    [config, state.memory, state.name, update],
  );

  const sample = (text: string) => {
    if (!config) return;
    const q = new TtsQueue(config.tts);
    q.voiceId = prefs.voiceId || config.voices[0]?.id || '';
    q.explainLang = prefs.lang;
    q.unlock();
    q.push(text);
    q.end();
  };

  // ---------- Qo'ng'iroq / tahlil ----------
  if (view.kind === 'live' && options) {
    return (
      <LiveCallScreen
        key={view.key}
        options={{ character: options.character, role: options.role, customRole: options.customRole, explicit: !!options.explicit, lang: options.lang, context: options.context }}
        subtitles={prefs.subtitles}
        onEnded={onEnded}
      />
    );
  }
  if (view.kind === 'call' && options) {
    return (
      <VoiceCallScreen
        key={view.key}
        options={options}
        subtitles={prefs.subtitles}
        fullscreen={prefs.fullscreen}
        game={prefs.game}
        onToggleSubtitles={() => setPrefs({ subtitles: !prefs.subtitles })}
        onSwitchMode={() => {
          setPrefs({ inputMode: prefs.inputMode === 'ptt' ? 'handsfree' : 'ptt' });
          setView({ kind: 'call', key: Date.now() });
        }}
        onEnded={onEnded}
        onUserTurn={onUserTurn}
      />
    );
  }
  if (view.kind === 'feedback') {
    return (
      <>
      {offer && <SuperOfferModal reason={offer} onClose={() => setOffer(null)} />}
      <FeedbackView
        record={view.record}
        lang={prefs.lang}
        onBack={() => {
          setHistory(loadHistory());
          setView({ kind: 'hub' });
        }}
        onAgain={() => {
          setHistory(loadHistory());
          setView(restUntil() > Date.now() ? { kind: 'hub' } : { kind: 'call', key: Date.now() });
        }}
        onExam={() => {
          setPrefs({ role: 'exam' });
          setHistory(loadHistory());
          setView({ kind: 'hub' });
        }}
      />
      </>
    );
  }

  // ---------- Tanishuv (birinchi marta) ----------
  if (!prefs.introSeen) {
    return (
      <div className="voice-intro">
        <div className="intro-hero">
          <h1>Yangi Vivi bilan tanishing</h1>
          <KruaLive shape="pill" action="wave" actionKey={1} size={220} />
          <ul className="intro-beats">
            <li>🤝 Do'stona</li>
            <li>🧘 Sabrli</li>
            <li>🎯 Kerak bo'lsa — talabchan</li>
            <li>📣 Doim siz tomonda</li>
            <li>🎉 Yutuqlaringizni nishonlaydi</li>
            <li>😏 …va biroz sho'x</li>
          </ul>
        </div>
        <div className="intro-cta">
          <h2>Tayyor bo'lsangiz, boshlaymiz</h2>
          <p className="muted">Xarakterni tanlang va gaplashishni boshlang</p>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => setPrefs({ introSeen: true })}>
            Davom etish
          </button>
        </div>
      </div>
    );
  }

  // ---------- Bosh sahifa ----------
  return (
    <div className="voice-hub">
      {offer && <SuperOfferModal reason={offer} onClose={() => setOffer(null)} />}
      <div className="vh-head">
        <div>
          <h1 className="page-title">Vivi AI</h1>
          <p className="muted">Jonli AI suhbatdoshingiz. Xarakterni tanlang va gaplashishni boshlang.</p>
        </div>
        <button type="button" className="icon-btn" aria-label="Qanday gaplashish kerak" onClick={() => setShowHelp(true)}>
          ❓
        </button>
      </div>

      <div className="char-carousel" role="list" aria-label="Xarakterni tanlang">
        {CHARACTERS.map((c) => (
          <div
            key={c.id}
            role="listitem"
            className={`char-card ${c.id === prefs.character ? 'on' : ''}`}
            style={{ ['--ch' as string]: c.color }}
            onClick={() => (c.adult ? (prefs.adultConfirmed ? setPrefs({ character: c.id }) : setConsentFor(c.id)) : c.consent && !prefs.strictConsent ? setConsentFor(c.id) : setPrefs({ character: c.id }))}
          >
            <div className="char-top">
              <span className="char-icon">{c.icon}</span>
              {c.id === prefs.character && <span className="char-check">✓</span>}
            </div>
            <b>{c.name}</b>
            <small className="char-tag">{c.tagline}</small>
            <p>{c.description}</p>
            <button
              type="button"
              className="char-sample"
              onClick={(e) => {
                e.stopPropagation();
                sample(c.sample);
              }}
            >
              ▶ «{c.sample}»
            </button>
          </div>
        ))}
      </div>

      <section className="vh-section">
        <h3>Rol — Vivi kim bo'ladi</h3>
        <div className="role-grid">
          {ROLES.map((r) => (
            <button key={r.id} type="button" className={`role-chip ${r.id === prefs.role ? 'on' : ''}`} onClick={() => setPrefs({ role: r.id })}>
              <span>{r.icon}</span> {r.title}
            </button>
          ))}
        </div>
        {prefs.role === 'custom' && (
          <div className="custom-role">
            <textarea
              value={prefs.customRole}
              maxLength={CUSTOM_ROLE_MAX}
              placeholder="Masalan: sen Parijdagi taksi haydovchisisan, men turistman. Fransuzcha oddiy gapir, xatolarimni tuzat…"
              onChange={(e) => setPrefs({ customRole: e.target.value })}
            />
            <div className="custom-meta">
              <span className={customOk ? 'muted' : 'warn'}>
                {customOk ? "Matningiz faqat shu qurilmada saqlanadi." : `Kamida ${CUSTOM_ROLE_MIN} ta belgi kerak`}
              </span>
              <span className="muted">
                {prefs.customRole.length} / {CUSTOM_ROLE_MAX}
              </span>
            </div>
            {prefs.customRole && (
              <button type="button" className="btn btn-text" onClick={() => setPrefs({ customRole: '' })}>
                Tozalash
              </button>
            )}
          </div>
        )}
      </section>

      <section className="vh-section two">
        <label className="vh-field">
          <span>Tushuntirish tili</span>
          <select value={prefs.lang} onChange={(e) => setPrefs({ lang: e.target.value as VoicePrefs['lang'] })}>
            {EXPLAIN_LANGS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <small className="muted">Vivi shu tilda tushuntiradi, mashq — fransuzcha.</small>
        </label>
        {config && config.voices.length > 0 && (
          <label className="vh-field">
            <span>Ovoz</span>
            <select value={prefs.voiceId || config.voices[0].id} onChange={(e) => setPrefs({ voiceId: e.target.value })}>
              {config.voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="vh-field">
          <span>Muloqot usuli</span>
          <div className="seg">
            <button type="button" className={prefs.inputMode === 'ptt' ? 'on' : ''} onClick={() => setPrefs({ inputMode: 'ptt' })}>
              Bosib gapirish
            </button>
            <button type="button" className={prefs.inputMode === 'handsfree' ? 'on' : ''} onClick={() => setPrefs({ inputMode: 'handsfree' })}>
              Qo'lsiz rejim
            </button>
          </div>
          <small className="muted">{prefs.inputMode === 'ptt' ? 'Vivini (yoki Space) bosib turib gapirasiz.' : 'Hech narsani bosmasdan gapirasiz — Vivi doimo tinglaydi.'}</small>
        </div>
      </section>

      <button type="button" className="vh-adv-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
        {showAdvanced ? '▾' : '▸'} Qo'shimcha sozlamalar
      </button>
      {showAdvanced && (
        <section className="vh-section two">
          <label className="vh-field">
            <span>Nutqni aniqlash</span>
            <select value={prefs.stt} onChange={(e) => setPrefs({ stt: e.target.value as VoicePrefs['stt'] })}>
              <option value="auto">AI — eng aniq (tavsiya)</option>
              <option value="browser" disabled={!browserSttSupported()}>
                Brauzer (tez, lekin o'zbekchada xato ko'p)
              </option>
              <option value="cloud" disabled={!config?.stt || !cloudSttSupported()}>
                AI (o'zbekcha + fransuzcha)
              </option>
            </select>
          </label>
          <label className="vh-field">
            <span>Men gapiradigan til</span>
            <select value={prefs.micLang} onChange={(e) => setPrefs({ micLang: e.target.value as VoicePrefs['micLang'] })}>
              <option value="auto">Avtomatik (Vivi javobiga qarab)</option>
              <option value="uz-UZ">O'zbekcha</option>
              <option value="fr-FR">Français</option>
              <option value="ru-RU">Русский</option>
              <option value="en-US">English</option>
            </select>
          </label>
          <label className="vh-field">
            <span>Gapirish tezligi</span>
            <input type="range" min={0.75} max={1.2} step={0.05} value={prefs.rate} onChange={(e) => setPrefs({ rate: Number(e.target.value) })} />
          </label>
          <label className="vh-check">
            <input type="checkbox" checked={prefs.subtitles} onChange={(e) => setPrefs({ subtitles: e.target.checked })} /> Subtitrlar
          </label>
          <label className="vh-check">
            <input type="checkbox" checked={prefs.fullscreen} onChange={(e) => setPrefs({ fullscreen: e.target.checked })} /> Suhbat paytida to'liq ekran
          </label>
          <label className="vh-check explicit-check">
            <input type="checkbox" checked={prefs.game} onChange={(e) => setPrefs({ game: e.target.checked })} /> 💥 Qasos rejimi <span className="badge-new">Yangi</span>
            <small>Kechki ko'chada Vivi, qurollar g'ildiragi va sog'liq chizig'i. Aytgan hamma gaplari uchun o'ch oling (multfilm uslubida).</small>
          </label>
          <label className="vh-check explicit-check">
            <input
              type="checkbox"
              checked={prefs.explicit && prefs.adultConfirmed}
              onChange={(e) => (e.target.checked && !prefs.adultConfirmed ? setConsentFor('explicit') : setPrefs({ explicit: e.target.checked }))}
            />{' '}
            🔞 Senzurasiz rejim (18+)
            <small>Har qanday xarakter keskinroq, filtrlanmagan iboralar bilan gapiradi. 18 yoshga to'lgan bo'lishingiz kerak.</small>
          </label>
        </section>
      )}

      {config && config.tts === 'browser' && !browserVoiceAvailable(prefs.lang) && (
        <p className="vh-note">ℹ️ Qurilmangizda {EXPLAIN_LANGS.find((l) => l.id === prefs.lang)!.label.toLowerCase()} ovoz topilmadi — Vivi fransuzcha qismlarni o'qiydi, qolgani subtitrda chiqadi.</p>
      )}

      {isFree && <SuperBanner onOpen={() => setOffer('enter')} />}

      {config?.live && (
        <button type="button" className={`live-toggle ${prefs.live ? 'on' : ''}`} onClick={() => setPrefs({ live: !prefs.live })} aria-pressed={prefs.live}>
          <span style={{ fontSize: 26 }}>⚡</span>
          <span>
            <b>Jonli rejim — Gemini Live</b>
            <small>
              Real vaqtda, emotsiyali ovoz; Vivi gapini istalgan payt bo'lish mumkin
              {config.premium ? '' : ` · bugun ${config.liveMinutes ?? 10} daqiqa bepul`}
            </small>
          </span>
          <span className="sw" />
        </button>
      )}

      <section className="vh-section memory-card">
        <div className="memory-head">
          <b>🧠 Vivi sizni eslaydi</b>
          {state.memory && (
            <button type="button" className="btn btn-text danger" onClick={() => update((s) => ({ ...s, memory: '' }))}>
              Unutish
            </button>
          )}
        </div>
        {state.memory ? (
          <ul className="memory-list">
            {state.memory
              .split('\n')
              .map((l) => l.replace(/^-\s*/, '').trim())
              .filter(Boolean)
              .slice(0, 8)
              .map((l, i) => (
                <li key={i}>{l}</li>
              ))}
          </ul>
        ) : (
          <p className="muted small">Hozircha xotira bo'sh. Suhbatlashganingiz sari Vivi sizning qiziqishlaringiz, maqsadingiz va o'tgan mavzularni eslab qoladi.</p>
        )}
      </section>

      {config && config.messagesLeft != null && (
        <p className="vh-quota">
          🎁 Bugun {config.messagesLeft} / {config.messagesPerDay} ta bepul xabar va {config.sessionMinutes} daqiqalik ovozli suhbat.{' '}
          <a href="#/shop">Super — cheksiz va Dilzoda ovozi</a>
        </p>
      )}
      <div className="vh-start">
        {liveOut ? (
          <div className="rest-card">
            <KruaLive state="sleeping" shape="pill" size={110} />
            <div>
              <b>Bugungi jonli suhbat tugadi</b>
              <p className="muted">Kuniga {10} daqiqa jonli suhbat bepul. Ertaga yana — yoki Super bilan cheklovsiz gaplashing.</p>
              <button type="button" className="btn btn-primary" onClick={() => setOffer('limit')}>
                ⭐ Hoziroq davom etish — Super
              </button>
            </div>
          </div>
        ) : resting ? (
          <div className="rest-card">
            <KruaLive state="sleeping" shape="pill" size={110} />
            <div>
              <b>Vivi dam olyapti</b>
              <p className="muted">Yaxshi suhbatlashdingiz! Keyingi suhbatdan oldin Viviga dam kerak. Yana tayyor bo'lishiga {fmtLeft(rest - now)} qoldi.</p>
              {isFree && (
                <button type="button" className="btn btn-primary" onClick={() => setOffer('limit')}>
                  ⭐ Hoziroq davom etish — Super
                </button>
              )}
            </div>
          </div>
        ) : !config ? (
          <button type="button" className="btn btn-primary btn-lg" disabled>
            Ulanmoqda…
          </button>
        ) : !canTalk ? (
          <p className="vh-note warn">{!config.ai ? "Ovozli suhbat hozir mavjud emas — AI server sozlanmagan." : "Bu brauzerda ovozli suhbat ishlamaydi. Chrome yoki Edge'da oching yoki «Matn» bo'limidan foydalaning."}</p>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-lg start-call"
            style={{ ['--ch' as string]: ch.color }}
            disabled={!customOk}
            onClick={() => setView({ kind: prefs.live && config.live ? 'live' : 'call', key: Date.now() })}
          >
            {prefs.live && config.live ? '⚡' : '🎙️'} {ch.name} bilan gaplashish · {prefs.live && config.live ? config.liveMinutes ?? config.sessionMinutes : config.sessionMinutes} daqiqagacha
          </button>
        )}
        <p className="tutor-note">Vivi — bu AI, u xato qilishi yoki kutilmagan tarzda javob berishi mumkin. Muhim qarorlarda unga tayanmang.</p>
      </div>

      <section className="vh-section">
        <h3>So'nggi suhbatlar</h3>
        {history.length === 0 ? (
          <p className="muted">Hozircha suhbatlar yo'q</p>
        ) : (
          <div className="recent-list">
            {history.slice(0, 6).map((h) => {
              const c = CHARACTERS.find((x) => x.id === h.character);
              const r = ROLES.find((x) => x.id === h.role);
              return (
                <button key={h.id} type="button" className="recent" onClick={() => setView({ kind: 'feedback', record: h })}>
                  <span className="recent-icon">{c?.icon}</span>
                  <span className="recent-text">
                    <b>
                      {r?.title} · {c?.name}
                    </b>
                    <small className="muted">
                      {new Date(h.at).toLocaleDateString()} · {h.stats.words} so'z · {Math.round(h.durationMs / 60000)} daq
                    </small>
                  </span>
                  <span className="recent-open">Tahlilni ochish ›</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {(consentFor === 'adult' || consentFor === 'explicit') && (
        <div className="modal-back" onClick={() => setConsentFor(null)}>
          <div className="sheet adult-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="big-emoji">🔞</div>
            <h3>{consentFor === 'explicit' ? 'Senzurasiz rejim — faqat 18 yoshdan kattalar uchun' : 'Bezori Vivi — faqat 18 yoshdan kattalar uchun'}</h3>
            <p className="muted">
              Bu xarakter so'kinadi, qo'pol hazil qiladi, sizni «qovuradi» va kattalar mavzularida (tanishuv, bar, ziyofat, ko'cha jargoni) gaplashadi.
              Haqoratli kamsitish va shahvoniy tasvirlar yo'q — lekin ohang qattiq. Istalgan vaqtda boshqa xarakterga o'tishingiz mumkin.
            </p>
            <button
              type="button"
              className="btn btn-danger btn-lg"
              onClick={() => {
                setPrefs(consentFor === 'explicit' ? { explicit: true, adultConfirmed: true } : { character: 'adult', adultConfirmed: true });
                setConsentFor(null);
              }}
            >
              Menga 18 yosh to'lgan — davom etish
            </button>
            <button type="button" className="btn btn-text" onClick={() => setConsentFor(null)}>
              Yo'q, orqaga
            </button>
          </div>
        </div>
      )}

      {consentFor && consentFor !== 'adult' && consentFor !== 'explicit' && (
        <div className="modal-back" onClick={() => setConsentFor(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="big-emoji">🎩</div>
            <h3>Boshlashdan oldin bilib qo'ying</h3>
            <p className="muted">Professor Vivi qattiqqo'l: bo'sh maqtov yo'q, javobni qayta-qayta talab qiladi. Bu haqorat emas — talabchan mashq. Agar sizga to'g'ri kelmasa, boshqa xarakterni tanlang.</p>
            <label className="vh-check explicit-check">
              <input type="checkbox" checked={prefs.explicit && prefs.adultConfirmed} onChange={(e) => setPrefs({ explicit: e.target.checked, adultConfirmed: e.target.checked || prefs.adultConfirmed })} /> 🔞 Senzurasiz rejim (18+)
              <small>Keskinroq, filtrlanmagan iboralarga ruxsat beradi. 18 yoshga to'lgan bo'lishingiz kerak.</small>
            </label>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() => {
                setPrefs({ character: consentFor as VoicePrefs['character'], strictConsent: true });
                setConsentFor(null);
              }}
            >
              Tushundim, davom etish
            </button>
            <button type="button" className="btn btn-text" onClick={() => setConsentFor(null)}>
              Orqaga
            </button>
          </div>
        </div>
      )}

      {showHelp && (
        <div className="modal-back" onClick={() => setShowHelp(false)}>
          <div className="sheet help" onClick={(e) => e.stopPropagation()}>
            <h3>Qanday gaplashish kerak</h3>
            <ol>
              <li>«Gaplashish»ni bosing va mikrofonga ruxsat bering.</li>
              <li>
                <b>Vivini (yoki Space) bosib turing</b>, gapiring, so'ng qo'yib yuboring. Qo'lsiz rejimda shunchaki gapiring.
              </li>
              <li>Vivi 1–2 soniyada javob bera boshlaydi. Gapini bo'lmoqchi bo'lsangiz — yana bosib turing (yoki gapiring): Vivi jim bo'lib tinglaydi.</li>
              <li>Vivi oxirgi 10 ta replika almashinuvini eslab qoladi. «Eshitmadim» desa — balandroq va mikrofonga yaqinroq gapiring.</li>
              <li>Suhbat {config?.sessionMinutes ?? 10} daqiqagacha davom etadi; oxirida tahlil va yangi so'zlar chiqadi.</li>
              <li>Fransuzcha iboralar ustiga bossangiz, qayta talaffuz qilinadi.</li>
              <li>Suhbatni ekranni yozib olish funksiyasi bilan videoga oling — «To'liq ekran» sozlamasi bunga qulay.</li>
            </ol>
            <h4>Vivining tanasi va yuzi</h4>
            <p className="muted small">
              Javob davomida Vivi o'zi shaklini o'zgartiradi: maqtaganda yulduz, yoqqanda yurak, xafa bo'lsa erib ketadi, yangi so'zda kitob yoki karta, jahli chiqqanda boshi alangalanadi. Gapida taniqli odam yoki joy tilga olinsa — uning rasmi chiqadi.
            </p>
            <h4>Ovoz teglari</h4>
            <p className="muted small">
              «O'z rolingiz» matniga kvadrat qavsdagi teglarni yozish mumkin, masalan: «har bir gapdan keyin <code>[burps]</code> qiladi, jahli chiqqanda <code>[whispers]</code>ga o'tadi».
              Teglar Vivining tanasini ham harakatlantiradi: <code>[laughs]</code> — sakraydi va qiqirlaydi, <code>[crying]</code> — cho'kadi, <code>[burps]</code> — pufak puflaydi,
              <code>[fart]</code> — yashil bulut chiqaradi, <code>[boundaries]</code> — qo'li bilan ko'rsatib qattiq qaraydi. Senzurasiz rejimda <code>[fuck]</code> — o'rta barmog'ini ko'rsatib alangalanadi (ovozda aytilmaydi).
            </p>
            <h4>Qasos rejimi</h4>
            <p className="muted small">Sozlamalarda yoqing: Vivini bosing yoki <kbd>F</kbd> — urish, <kbd>Q</kbd> — qurollar g'ildiragi, <kbd>1</kbd>–<kbd>6</kbd> — qurol tanlash, gapirish uchun 🎤 tugma yoki <kbd>Space</kbd>.</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setShowHelp(false)}>
              Tushunarli
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
