import { PurchaseToast, Reviews, StatsLine, SupportRow, useSocial } from '../components/SocialProof';
// Voilà Super: obuna sahifasi — taqqoslash narxi, tariflar (chegirma bilan), to'lov usullari:
// Payme / Click (avtomatik) va karta orqali o'tkazma (chek yuklanadi, admin tasdiqlaydi).
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { accountApi, useAccount, type PlanId } from '../state/account';
import { AuthScreen } from './Auth';
import { Confetti } from '../components/Confetti';

const PERKS = [
  ['⚡', 'Jonli rejim — cheksiz', 'Gemini Live bilan real vaqtda, emotsiyali suhbat'],
  ['🎙️', 'Vivi bilan cheksiz suhbat', '30 daqiqalik sessiyalar, dam olish kutilmaydi'],
  ['💬', 'Cheksiz xabarlar', 'Kunlik 30 ta xabar chegarasi yo\'q'],
  ['☕', 'Cheksiz kofe', 'Xato qilsangiz ham darsdan chiqib ketmaysiz'],
  ['🚫', 'Reklamasiz', 'Darslar va suhbat orasida reklama yo\'q'],
  ['☀️', 'Seriyani bepul tiklash', 'Uzilgan seriyani 2 kun ichida tangasiz tiklaysiz'],
];

const fmt = (n: number) => n.toLocaleString('ru-RU').replace(/[, ]/g, ' ');

/** Rasmni chek sifatida yuborish uchun kichraytiradi (PDF o'zgarishsiz). */
async function fileToDataUrl(f: File): Promise<string> {
  if (f.type === 'application/pdf') {
    return await new Promise((ok, fail) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = () => fail(r.error);
      r.readAsDataURL(f);
    });
  }
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => fail(new Error('img'));
      i.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function CardPay({ plan, amount, kind = 'card', onDone, onClose }: { plan: PlanId; amount: number; kind?: 'card' | 'visa'; onDone: (orderId: number) => void; onClose: () => void }) {
  const { me } = useAccount();
  const card = (kind === 'visa' ? me.billing.visa : me.billing.card)!;
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(card.number.replace(/\s/g, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* nusxa olinmadi */
    }
  };
  const submit = async () => {
    if (!file) return setErr('Avval chekni yuklang');
    setBusy(true);
    setErr(null);
    try {
      const receipt = await fileToDataUrl(file);
      const r = await accountApi<{ id?: number; message?: string }>('billing/card', { method: 'POST', body: JSON.stringify({ plan, receipt, kind }) });
      if (!r.ok || !r.body.id) return setErr(r.body.message ?? "Yuborib bo'lmadi");
      onDone(r.body.id);
    } catch {
      setErr("Chekni o'qib bo'lmadi — boshqa rasm tanlang");
    } finally {
      setBusy(false);
    }
  };
  return createPortal(
    <div className="modal-back" onClick={onClose}>
      <div className="sheet card-pay" onClick={(e) => e.stopPropagation()}>
        <h3>💳 Karta orqali to'lash</h3>
        <ol className="card-steps">
          <li>
            {kind === 'visa' ? (
              <>
                Quyidagi Visa kartaga <b>{'$'}{Math.ceil((amount / (me.billing.visa?.usdRate || 12800)) * 2) / 2}</b> ({fmt(amount)} so'm) o'tkazing:
              </>
            ) : (
              <>
                Quyidagi kartaga <b>{fmt(amount)} so'm</b> o'tkazing:
              </>
            )}
            <button type="button" className="card-number" onClick={copy}>
              <span>{card.number}</span>
              <small>{copied ? '✓ Nusxa olindi' : 'Nusxa olish'}</small>
            </button>
            {(card.owner || card.bank) && (
              <small className="muted">
                {card.owner}
                {card.owner && card.bank ? ' · ' : ''}
                {card.bank}
              </small>
            )}
          </li>
          <li>
            To'lov chekini (skrinshot yoki PDF) yuklang:
            <button type="button" className={`receipt-drop ${file ? 'has' : ''}`} onClick={() => fileRef.current?.click()}>
              {file ? `📎 ${file.name}` : '📷 Chekni tanlash'}
            </button>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </li>
          <li>Tekshiruvdan so'ng (odatda bir necha daqiqa) Super avtomatik yoqiladi.</li>
        </ol>
        {err && <p className="auth-error">{err}</p>}
        <button type="button" className="btn btn-primary btn-lg" disabled={busy || !file} onClick={submit}>
          {busy ? 'Yuborilmoqda…' : 'Chekni yuborish'}
        </button>
        <button type="button" className="btn btn-text" onClick={onClose}>
          Bekor qilish
        </button>
      </div>
    </div>,
    document.body,
  );
}

export function SuperPage({ onClose }: { onClose?: () => void }) {
  const { me, premium, refresh } = useAccount();
  const plans = me.billing.plans;
  const [plan, setPlan] = useState<PlanId>(() => (plans.find((p) => p.id === 'month') ?? plans[0])?.id ?? 'month');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needAuth, setNeedAuth] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [cardKind, setCardKind] = useState<'card' | 'visa'>('card');
  const social = useSocial();
  const [review, setReview] = useState<{ id: number; status: string } | null>(null);
  const sel = plans.find((p) => p.id === plan) ?? plans[0];
  const anchor = me.billing.anchor;

  // To'lovdan qaytganda (#/shop?paid=ID) yoki chek yuborilgach — buyurtma holatini kuzatamiz.
  useEffect(() => {
    const fromHash = /[?&]paid=(\d+)/.exec(location.hash)?.[1];
    const id = review?.id ?? (fromHash ? Number(fromHash) : null);
    if (!id) return;
    let tries = 0;
    let stop = false;
    const tick = async () => {
      const r = await accountApi<{ status?: string }>(`billing/order?id=${id}`);
      if (stop) return;
      if (r.ok && r.body.status === 'paid') {
        await refresh();
        setCelebrate(true);
        setReview(null);
        history.replaceState(null, '', '#/shop');
        return;
      }
      if (r.ok && r.body.status === 'rejected') return setReview({ id, status: 'rejected' });
      if (++tries < 400 && (!r.ok || r.body.status === 'pending' || r.body.status === 'review')) setTimeout(tick, review ? 8000 : 3000);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [refresh, review?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const pay = async (provider: 'payme' | 'click' | 'card' | 'visa' | 'telegram') => {
    if (!me.user) return setNeedAuth(true);
    if (provider === 'card' || provider === 'visa') {
      setCardKind(provider);
      return setCardOpen(true);
    }
    if (provider === 'telegram') {
      // Oynani darhol ochamiz (iOS Safari popup blokidan qochish uchun), havolani keyin beramiz.
      const w = window.open('', '_blank');
      setBusy('telegram');
      const r = await accountApi<{ url?: string; message?: string }>('billing/telegram', { method: 'POST', body: '{}' });
      setBusy(null);
      if (!r.ok || !r.body.url) {
        w?.close();
        return setError(r.body.message ?? "Telegram botni ochib bo'lmadi");
      }
      if (w) w.location.href = r.body.url;
      else location.href = r.body.url;
      return;
    }
    setBusy(provider);
    setError(null);
    const r = await accountApi<{ payUrl?: string; message?: string }>('billing/order', { method: 'POST', body: JSON.stringify({ plan, provider }) });
    setBusy(null);
    if (!r.ok || !r.body.payUrl) return setError(r.body.message ?? "To'lovni boshlab bo'lmadi");
    location.href = r.body.payUrl;
  };

  if (needAuth) {
    return (
      <div className="page">
        <AuthScreen initial="register" title="Obuna uchun profil yarating" onDone={() => setNeedAuth(false)} onSkip={() => setNeedAuth(false)} />
      </div>
    );
  }

  if (premium) {
    return (
      <div className="super super-active">
        {celebrate && <Confetti />}
        <div className="super-badge">SUPER</div>
        <h2>{celebrate ? "Tabriklaymiz! Siz endi Super a'zosisiz" : "Siz Super a'zosisiz"}</h2>
        <p className="muted">
          {me.admin ? 'Admin rejimi' : `${plans.find((p) => p.id === me.plan)?.label ?? 'Super'} obuna`}
          {me.expiresAt && !me.admin ? ` · ${new Date(me.expiresAt).toLocaleDateString('uz-UZ')} gacha` : ''}
        </p>
        <ul className="super-perks">
          {PERKS.map(([i, t]) => (
            <li key={t}>
              <span>{i}</span>
              <b>{t}</b>
              <em>✓</em>
            </li>
          ))}
        </ul>
        {onClose && (
          <button type="button" className="btn btn-primary btn-lg" onClick={onClose}>
            Davom etish
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="super">
      <div className="super-badge">SUPER</div>
      <h2>Fransuzchani tezroq — cheklovsiz</h2>
      <StatsLine data={social} />

      {anchor && sel && (
        <div className="price-anchor">
          <span>
            💡 {anchor.label}: <s>{fmt(anchor.uzs)} so'm</s>
          </span>
          <b>Bizda atigi {fmt(sel.uzs)} so'm!</b>
        </div>
      )}

      {plans.length > 0 && (
        <div className={`plan-grid n${Math.min(3, plans.length)}`} role="radiogroup" aria-label="Tarif">
          {plans.map((p) => {
            const off = p.oldUzs && p.oldUzs > p.uzs ? Math.round((1 - p.uzs / p.oldUzs) * 100) : 0;
            const perDay = Math.round(p.uzs / p.days / 100) * 100;
            return (
              <button key={p.id} type="button" role="radio" aria-checked={plan === p.id} className={`plan-card ${plan === p.id ? 'on' : ''} ${p.id === 'month' ? 'popular' : ''}`} onClick={() => setPlan(p.id)}>
                {p.id === 'month' && <span className="plan-pop">Ommabop</span>}
                {off > 0 && <span className="plan-tag">−{off}%</span>}
                <b className="plan-name">{p.label ?? p.name}</b>
                {p.oldUzs && p.oldUzs > p.uzs ? <s className="plan-old">{fmt(p.oldUzs)}</s> : null}
                <span className="plan-price">
                  {fmt(p.uzs)} <small>so'm</small>
                </span>
                <small className="muted">kuniga ~{fmt(perDay)} so'm</small>
              </button>
            );
          })}
        </div>
      )}

      <ul className="super-perks">
        {PERKS.map(([i, t, d]) => (
          <li key={t}>
            <span>{i}</span>
            <div>
              <b>{t}</b>
              <small>{d}</small>
            </div>
          </li>
        ))}
      </ul>

      {review?.status === 'rejected' ? (
        <p className="auth-error">Chek tasdiqlanmadi. To'lov summasi va chekni tekshirib, qayta yuboring yoki biz bilan bog'laning.</p>
      ) : review ? (
        <div className="review-note">⏳ Chekingiz tekshirilmoqda. Tasdiqlangach, Super o'zi yoqiladi — bu sahifani yopsangiz ham bo'ladi.</div>
      ) : null}

      {me.billing.providers.length > 0 ? (
        <div className="pay-buttons">
          {me.billing.providers.includes('payme') && (
            <button type="button" className="btn btn-pay payme" disabled={!!busy} onClick={() => pay('payme')}>
              {busy === 'payme' ? 'Kuting…' : "Payme orqali to'lash"}
            </button>
          )}
          {me.billing.providers.includes('click') && (
            <button type="button" className="btn btn-pay click" disabled={!!busy} onClick={() => pay('click')}>
              {busy === 'click' ? 'Kuting…' : "Click orqali to'lash"}
            </button>
          )}
          {me.billing.providers.includes('card') && (
            <button type="button" className="btn btn-pay card" disabled={!!busy} onClick={() => pay('card')}>
              💳 Karta orqali (Uzcard / Humo)
            </button>
          )}
          {me.billing.providers.includes('visa') && (
            <button type="button" className="btn btn-pay visa" disabled={!!busy} onClick={() => pay('visa')}>
              🌍 Visa / Mastercard
            </button>
          )}
          {me.billing.telegram && (
            <button type="button" className="btn btn-pay telegram" disabled={!!busy} onClick={() => pay('telegram')}>
              {busy === 'telegram' ? 'Kuting…' : "✈️ Telegram bot orqali to'lash"}
            </button>
          )}
        </div>
      ) : (
        <p className="vh-note">To'lov tizimi tez orada ulanadi.</p>
      )}
      {error && <p className="auth-error">{error}</p>}
      <p className="super-fine muted">Obuna avtomatik yangilanmaydi — muddati tugagach qayta to'laysiz.</p>
      <SupportRow data={social} />
      <Reviews data={social} />
      <PurchaseToast data={social} />
      {cardOpen && sel && (
        <CardPay
          kind={cardKind}
          plan={sel.id}
          amount={sel.uzs}
          onClose={() => setCardOpen(false)}
          onDone={(id) => {
            setCardOpen(false);
            setReview({ id, status: 'review' });
          }}
        />
      )}
    </div>
  );
}
