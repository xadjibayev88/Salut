// Voilà Telegram to'lov boti: tariflar → karta raqami → chek (rasm/PDF) → admin ✅/❌ → Super faollashadi.
// Long polling (webhook shart emas). Faqat TELEGRAM_BOT_TOKEN bo'lsa ishga tushadi.
// Hisob bog'lash: ilovadagi «Telegram orqali to'lash» → t.me/<bot>?start=pay_<kod> (kod 30 daqiqa amal qiladi).
// Kodsiz kirgan foydalanuvchi uchun Telegram hisobi ochiladi (ilovaga «Telegram bilan kirish» orqali shu hisob bilan kiradi).
import { randomBytes } from 'node:crypto';
import { db } from './db.ts';
import { getUser, upsertSocialUser } from './accounts.ts';
import { PLANS, activePlan, createCardOrder, decideOrder, isAdmin, oldPriceUzs, plansPayload, priceUzs, visiblePlans, type PlanId } from './billing.ts';

type Tg = (method: string, body: Record<string, unknown>) => Promise<any>;
type From = { id: number; first_name?: string; last_name?: string; username?: string };

const env = (k: string) => (process.env[k] ?? '').trim();
const som = (n: number) => n.toLocaleString('ru-RU').replace(/ /g, ' ');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const appUrl = () => env('PUBLIC_URL') || 'https://voila-fr.up.railway.app';

// ---------- Hisob bog'lash ----------

/** Ilova uchun bir martalik bog'lash kodi. */
export function createLinkCode(userId: string): string {
  const code = randomBytes(9).toString('base64url');
  db().prepare('DELETE FROM tg_links WHERE expires_at < ?').run(Date.now());
  db().prepare('INSERT INTO tg_links (code, user_id, expires_at) VALUES (?, ?, ?)').run(code, userId, Date.now() + 30 * 60_000);
  return code;
}

function linkByCode(code: string, tgId: string): string | null {
  const r = db().prepare('SELECT user_id FROM tg_links WHERE code = ? AND expires_at > ?').get(code, Date.now()) as { user_id: string } | undefined;
  if (!r || !getUser(r.user_id)) return null;
  db().prepare('DELETE FROM tg_links WHERE code = ?').run(code);
  db().prepare('INSERT OR REPLACE INTO identities (provider, subject, user_id) VALUES (?, ?, ?)').run('telegram', tgId, r.user_id);
  return r.user_id;
}

function userOf(from: From): string {
  const name = [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || 'Telegram';
  return upsertSocialUser('telegram', String(from.id), null, name, null).id;
}

function chatOfUser(userId: string): string | null {
  const r = db().prepare("SELECT subject FROM identities WHERE provider = 'telegram' AND user_id = ?").get(userId) as { subject: string } | undefined;
  return r?.subject ?? null;
}

/** Cheklar yuboriladigan admin chatlari: ADMIN_TELEGRAM_CHAT_ID + ADMIN_EMAILS hisobiga bog'langan Telegramlar. */
export function adminChats(): string[] {
  const set = new Set(env('ADMIN_TELEGRAM_CHAT_ID').split(',').map((s) => s.trim()).filter(Boolean));
  const rows = db().prepare("SELECT subject, user_id FROM identities WHERE provider = 'telegram'").all() as { subject: string; user_id: string }[];
  for (const r of rows) if (isAdmin(r.user_id)) set.add(r.subject);
  return [...set];
}

const setPlan = (chat: string, plan: PlanId | null) =>
  db().prepare('INSERT INTO tg_state (chat_id, plan, updated_at) VALUES (?, ?, ?) ON CONFLICT(chat_id) DO UPDATE SET plan = excluded.plan, updated_at = excluded.updated_at').run(chat, plan, Date.now());
const planOf = (chat: string) => (db().prepare('SELECT plan FROM tg_state WHERE chat_id = ?').get(chat) as { plan: PlanId | null } | undefined)?.plan ?? null;

// ---------- Matnlar ----------

const MAIN_KB = { inline_keyboard: [[{ text: '💎 Super tariflari', callback_data: 'plans' }], [{ text: '👤 Mening obunam', callback_data: 'me' }, { text: '📱 Ilovani ochish', url: appUrl() }]] };

function plansText(): string {
  const anchor = plansPayload().anchor;
  const lines = visiblePlans().map((id) => {
    const now = priceUzs(id);
    const old = oldPriceUzs(id);
    const off = old > now ? ` <b>−${Math.round((1 - now / old) * 100)}%</b>` : '';
    const perDay = Math.round(now / PLANS[id].days / 100) * 100;
    return `${id === 'month' ? '🔥' : '▫️'} <b>${PLANS[id].label}</b> — ${old > now ? `<s>${som(old)}</s> ` : ''}<b>${som(now)} so'm</b>${off}\n     ≈ kuniga ${som(perDay)} so'm${id === 'month' ? ' · <i>eng ommabop</i>' : ''}`;
  });
  return [
    '💎 <b>Voilà Super</b> — fransuz tilini Vivi bilan cheksiz o\'rgan!',
    '',
    '✅ Vivi ustoz bilan cheksiz ovozli suhbat',
    '✅ Gemini Live — jonli suhbat, cheklovsiz',
    '✅ Eng tiniq ovoz (ElevenLabs)',
    '✅ Cheksiz xabar, reklamasiz',
    '✅ Barcha darajalar: A1 → C2',
    '',
    `💸 ${esc(anchor.label)}: <s>${som(anchor.uzs)} so'm</s>`,
    '👇 Bizda esa:',
    '',
    ...lines,
    '',
    'Tarifni tanlang:',
  ].join('\n');
}

function plansKb() {
  return { inline_keyboard: [...visiblePlans().map((id) => [{ text: `${PLANS[id].label} — ${som(priceUzs(id))} so'm`, callback_data: `plan:${id}` }]), [{ text: '⬅️ Orqaga', callback_data: 'home' }]] };
}

function payText(plan: PlanId): string {
  const c = plansPayload().card;
  return [
    `🧾 <b>${PLANS[plan].name}</b>`,
    `To'lov summasi: <b>${som(priceUzs(plan))} so'm</b>`,
    '',
    '💳 Quyidagi kartaga o\'tkazing:',
    `<code>${esc(c?.number ?? '—')}</code>`,
    ...(c?.owner ? [`👤 ${esc(c.owner)}${c.bank ? ` · ${esc(c.bank)}` : ''}`] : []),
    '',
    '📸 To\'lovdan so\'ng <b>chek rasmini (skrinshot yoki PDF)</b> shu yerga yuboring.',
    '⏱ Admin 5–30 daqiqada tekshiradi va Super avtomatik yoqiladi.',
  ].join('\n');
}

function meText(userId: string): string {
  const p = activePlan(userId);
  const u = getUser(userId);
  if (p.plan === 'free') return `👤 ${esc(u?.name || 'Foydalanuvchi')}\nObuna: <b>bepul</b>\n\nSuper olish uchun «💎 Super tariflari» ni bosing.`;
  return `👤 ${esc(u?.name || 'Foydalanuvchi')}\nObuna: <b>💎 Super</b>\nAmal qiladi: <b>${new Date(p.expiresAt!).toLocaleDateString('ru-RU', { timeZone: 'Asia/Tashkent' })}</b> gacha`;
}

// ---------- Bot mantiqi ----------

export function createBot(tg: Tg, download: (fileId: string) => Promise<{ mime: string; data: Buffer } | null>) {
  const send = (chat: string | number, text: string, extra: Record<string, unknown> = {}) =>
    tg('sendMessage', { chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra });

  /** Yangi chekni adminlarga rasm + tugmalar bilan yuboradi (ilova va bot cheklari uchun). */
  async function notifyReceipt(orderId: number, plan: PlanId, amount: number, who: string, receipt: string) {
    const caption = `🧾 <b>Yangi chek #${orderId}</b>\n${esc(PLANS[plan].name)} · <b>${som(amount)} so'm</b>\n👤 ${esc(who)}`;
    const kb = { inline_keyboard: [[{ text: '✅ Tasdiqlash', callback_data: `ok:${orderId}` }, { text: '❌ Rad etish', callback_data: `no:${orderId}` }]] };
    const m = /^data:([^;]+);base64,(.*)$/s.exec(receipt);
    for (const chat of adminChats()) {
      try {
        if (m) {
          const isPdf = m[1] === 'application/pdf';
          const form = new FormData();
          form.set('chat_id', chat);
          form.set('caption', caption);
          form.set('parse_mode', 'HTML');
          form.set('reply_markup', JSON.stringify(kb));
          form.set(isPdf ? 'document' : 'photo', new Blob([Buffer.from(m[2], 'base64')], { type: m[1] }), isPdf ? `chek-${orderId}.pdf` : `chek-${orderId}.jpg`);
          await tg(isPdf ? 'sendDocument' : 'sendPhoto', { __form: form });
        } else await send(chat, caption, { reply_markup: kb });
      } catch {
        await send(chat, caption, { reply_markup: kb }).catch(() => {});
      }
    }
  }

  /** Buyurtma hal qilinganda foydalanuvchiga xabar (ilovadagi admin sahifasidan ham chaqiriladi). */
  async function notifyDecision(userId: string, approve: boolean) {
    const chat = chatOfUser(userId);
    if (!chat) return;
    await send(
      chat,
      approve
        ? `🎉 <b>To'lov tasdiqlandi!</b>\n💎 Super faollashdi — ${esc(meText(userId).split('\n').slice(2).join(' '))}\n\nIlovani oching va Vivi bilan cheksiz gaplashing!`
        : "❌ Chek tasdiqlanmadi. Summa yoki chek noto'g'ri bo'lishi mumkin. Savol bo'lsa shu yerga yozing.",
      { reply_markup: approve ? { inline_keyboard: [[{ text: '📱 Ilovani ochish', url: appUrl() }]] } : MAIN_KB },
    ).catch(() => {});
  }

  async function onMessage(msg: any) {
    const chat = String(msg.chat.id);
    if (msg.chat.type !== 'private') return;
    const from: From = msg.from;
    const text: string = msg.text ?? '';

    if (text.startsWith('/start')) {
      const arg = text.split(/\s+/)[1] ?? '';
      let uid: string | null = null;
      if (arg.startsWith('pay_')) uid = linkByCode(arg.slice(4), String(from.id));
      const linked = !!uid;
      uid ??= userOf(from);
      const name = esc(from.first_name || 'do\'stim');
      await send(chat, `Bonjour, ${name}! 🐱\nMen <b>Voilà!</b> botiman — bu yerda Super obunani tez va oson olasiz.${linked ? '\n\n✅ Ilovadagi hisobingiz bog\'landi.' : ''}`, { reply_markup: MAIN_KB });
      if (arg.startsWith('pay_') || arg === 'plans') await send(chat, plansText(), { reply_markup: plansKb() });
      return;
    }
    if (text === '/plans' || text === '/tariflar') return send(chat, plansText(), { reply_markup: plansKb() });
    if (text === '/id' || text === '/myid') return send(chat, `Sizning chat ID: <code>${chat}</code>`);
    if (text === '/me') return send(chat, meText(userOf(from)), { reply_markup: MAIN_KB });

    const file = msg.photo?.length ? { id: msg.photo[msg.photo.length - 1].file_id, mime: 'image/jpeg' } : msg.document ? { id: msg.document.file_id, mime: msg.document.mime_type || '' } : null;
    if (file) {
      const plan = planOf(chat);
      if (!plan) return send(chat, '📸 Chekni yuborishdan oldin tarifni tanlang 👇', { reply_markup: plansKb() });
      if (!/^(image\/(png|jpe?g|webp|heic)|application\/pdf)$/.test(file.mime)) return send(chat, '⚠️ Chekni rasm yoki PDF ko\'rinishida yuboring.');
      const got = await download(file.id).catch(() => null);
      if (!got || got.data.length > 2_900_000) return send(chat, '⚠️ Faylni yuklab bo\'lmadi (3 MB gacha bo\'lsin). Qayta yuboring.');
      const uid = userOf(from);
      const receipt = `data:${file.mime === 'image/jpg' ? 'image/jpeg' : file.mime || got.mime};base64,${got.data.toString('base64')}`;
      const r = createCardOrder(uid, plan, receipt);
      if ('error' in r) return send(chat, `⚠️ ${esc(r.error)}`);
      setPlan(chat, null);
      await send(chat, `✅ Chek qabul qilindi (#${r.id}).\n⏱ Admin tekshirgach, Super avtomatik yoqiladi va sizga xabar beraman.`);
      const who = [from.first_name, from.last_name].filter(Boolean).join(' ') + (from.username ? ` @${from.username}` : '') + ` (tg ${from.id})`;
      await notifyReceipt(r.id, r.plan, r.amountUzs, who, receipt);
      return;
    }
    return send(chat, 'Quyidagi tugmalardan foydalaning 👇', { reply_markup: MAIN_KB });
  }

  async function onCallback(q: any) {
    const chat = String(q.message?.chat?.id ?? q.from.id);
    const data: string = q.data ?? '';
    const ack = (text = '', alert = false) => tg('answerCallbackQuery', { callback_query_id: q.id, text, show_alert: alert }).catch(() => {});

    if (data === 'plans') return ack(), send(chat, plansText(), { reply_markup: plansKb() });
    if (data === 'home') return ack(), send(chat, 'Asosiy menyu 👇', { reply_markup: MAIN_KB });
    if (data === 'me') return ack(), send(chat, meText(userOf(q.from)), { reply_markup: MAIN_KB });
    if (data.startsWith('plan:')) {
      const plan = data.slice(5) as PlanId;
      if (!(plan in PLANS)) return ack();
      if (!plansPayload().card) return ack("Karta orqali to'lov hozircha yoqilmagan", true);
      setPlan(chat, plan);
      await ack();
      return send(chat, payText(plan), { reply_markup: { inline_keyboard: [[{ text: '⬅️ Boshqa tarif', callback_data: 'plans' }]] } });
    }
    const m = /^(ok|no):(\d+)$/.exec(data);
    if (m) {
      if (!adminChats().includes(String(q.from.id))) return ack("Ruxsat yo'q", true);
      const id = Number(m[2]);
      const order = db().prepare('SELECT user_id FROM orders WHERE id = ?').get(id) as { user_id: string } | undefined;
      const approve = m[1] === 'ok';
      const done = decideOrder(id, approve);
      await ack(done ? (approve ? '✅ Tasdiqlandi' : '❌ Rad etildi') : 'Bu chek allaqachon hal qilingan', !done);
      if (done && q.message) {
        const note = `\n\n${approve ? '✅ Tasdiqlandi' : '❌ Rad etildi'} — ${esc(q.from.first_name ?? 'admin')}`;
        const cap = (q.message.caption ?? q.message.text ?? '') + note;
        await tg(q.message.caption !== undefined ? 'editMessageCaption' : 'editMessageText', {
          chat_id: q.message.chat.id, message_id: q.message.message_id, [q.message.caption !== undefined ? 'caption' : 'text']: cap, reply_markup: { inline_keyboard: [] },
        }).catch(() => {});
      }
      if (done && order) await notifyDecision(order.user_id, approve);
      return;
    }
    return ack();
  }

  async function handle(update: any) {
    try {
      if (update.message) await onMessage(update.message);
      else if (update.callback_query) await onCallback(update.callback_query);
    } catch (e) {
      console.error('bot:', (e as Error).message);
    }
  }

  return { handle, notifyReceipt, notifyDecision };
}

// ---------- Telegram API + polling ----------

export type Bot = ReturnType<typeof createBot>;
let active: Bot | null = null;
let username = env('TELEGRAM_BOT_USERNAME').replace(/^@/, '');
/** Ishlayotgan bot (token bo'lmasa null). */
export const bot = () => active;
/** Bot username (getMe orqali aniqlanadi). */
export const botUsername = () => (active ? username || null : null);

export function startBot(token = env('TELEGRAM_BOT_TOKEN')): Bot | null {
  if (!token) return null;
  const base = `https://api.telegram.org/bot${token}`;
  const tg: Tg = async (method, body) => {
    const form = body.__form as FormData | undefined;
    const res = await fetch(`${base}/${method}`, form ? { method: 'POST', body: form, signal: AbortSignal.timeout(30_000) } : {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(method === 'getUpdates' ? 65_000 : 15_000),
    });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: unknown; description?: string; error_code?: number };
    if (!j.ok) throw Object.assign(new Error(j.description || `telegram ${res.status}`), { code: j.error_code ?? res.status });
    return j.result;
  };
  const download = async (fileId: string) => {
    const f = (await tg('getFile', { file_id: fileId })) as { file_path?: string; file_size?: number };
    if (!f.file_path || (f.file_size ?? 0) > 3_000_000) return null;
    const r = await fetch(`https://api.telegram.org/file/bot${token}/${f.file_path}`, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return null;
    return { mime: r.headers.get('content-type') || 'image/jpeg', data: Buffer.from(await r.arrayBuffer()) };
  };
  active = createBot(tg, download);
  const b = active;

  void (async () => {
    await tg('deleteWebhook', {}).catch(() => {});
    const me = (await tg('getMe', {}).catch(() => null)) as { username?: string } | null;
    if (me?.username) username = me.username;
    await tg('setMyCommands', { commands: [{ command: 'start', description: 'Boshlash' }, { command: 'plans', description: '💎 Super tariflari' }, { command: 'me', description: 'Mening obunam' }] }).catch(() => {});
    let offset = 0;
    for (;;) {
      try {
        const ups = (await tg('getUpdates', { offset, timeout: 50, allowed_updates: ['message', 'callback_query'] })) as { update_id: number }[];
        for (const u of ups) {
          offset = u.update_id + 1;
          await b.handle(u);
        }
      } catch (e) {
        // 409: deploy paytida eski nusxa hali ishlayapti — kutamiz.
        await new Promise((r) => setTimeout(r, (e as { code?: number }).code === 409 ? 5000 : 3000));
      }
    }
  })();
  console.log('Telegram bot ishga tushdi');
  return b;
}
