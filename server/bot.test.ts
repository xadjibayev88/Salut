import { beforeEach, describe, expect, it } from 'vitest';
process.env.SALUT_DB = ':memory:';
process.env.SESSION_SECRET = 'x'.repeat(40);
import { resetDbForTests } from './db.ts';
import { register, upsertGoogleUser } from './accounts.ts';
import { activePlan } from './billing.ts';
import { adminChats, createBot, createLinkCode } from './bot.ts';

type Call = { method: string; body: Record<string, any> };

function setup() {
  const calls: Call[] = [];
  const tg = async (method: string, body: Record<string, unknown>) => {
    calls.push({ method, body: body as Record<string, any> });
    return true;
  };
  const bot = createBot(tg, async () => ({ mime: 'image/jpeg', data: Buffer.from('fakejpeg') }));
  return { calls, bot };
}
const msg = (id: number, extra: Record<string, unknown>) => ({ message: { chat: { id, type: 'private' }, from: { id, first_name: 'Ali' }, ...extra } });
const cb = (id: number, data: string, message?: unknown) => ({ callback_query: { id: 'q', from: { id, first_name: 'Boss' }, data, message: message ?? { chat: { id }, message_id: 1, text: 't' } } });

beforeEach(() => {
  resetDbForTests();
  process.env.PAY_CARD_NUMBER = '9860 0000 0000 0000';
  process.env.PAY_CARD_OWNER = 'TEST';
  process.env.PAY_VISA_NUMBER = '4111 1111 1111 1111';
  process.env.ADMIN_EMAILS = 'boss@example.com';
  delete process.env.ADMIN_TELEGRAM_CHAT_ID;
});

describe('telegram bot', () => {
  it('shows tariffs with old prices and the card after choosing a plan', async () => {
    const { calls, bot } = setup();
    await bot.handle(msg(5, { text: '/plans' }));
    const t = calls.at(-1)!.body.text as string;
    expect(t).toContain('<s>79 000</s>');
    expect(t).toContain("49 000 so'm");
    await bot.handle(cb(5, 'plan:month'));
    const kb = JSON.stringify(calls.at(-1)!.body.reply_markup);
    expect(kb).toContain('pay:card:month');
    expect(kb).toContain('pay:visa:month');
    await bot.handle(cb(5, 'pay:card:month'));
    expect(calls.at(-1)!.body.text).toContain('9860 0000 0000 0000');
    await bot.handle(cb(5, 'pay:visa:month'));
    expect(calls.at(-1)!.body.text).toContain('4111');
  });

  it('links an app account by code, takes a receipt, admin approves → Super', async () => {
    const { calls, bot } = setup();
    const user = register('ali@example.com', 'parol12345', 'Ali');
    if (!user.ok) throw new Error('register');
    const boss = { user: upsertGoogleUser('g-boss', 'boss@example.com', 'Boss', null) };
    // Admin o'z hisobini bog'laydi — cheklar unga keladi.
    await bot.handle(msg(900, { text: `/start pay_${createLinkCode(boss.user.id)}` }));
    expect(adminChats()).toContain('900');

    await bot.handle(msg(7, { text: `/start pay_${createLinkCode(user.user.id)}` }));
    expect(calls.some((c) => String(c.body.text).includes('bog'))).toBe(true);
    await bot.handle(cb(7, 'plan:week'));
    await bot.handle(cb(7, 'pay:card:week'));
    await bot.handle(msg(7, { photo: [{ file_id: 'small' }, { file_id: 'big' }] }));
    const toAdmin = calls.find((c) => c.method === 'sendPhoto');
    expect(toAdmin).toBeTruthy();
    expect((toAdmin!.body.__form as FormData).get('chat_id')).toBe('900');

    // Admin bo'lmagan odam tasdiqlay olmaydi.
    await bot.handle(cb(7, 'ok:1'));
    expect(activePlan(user.user.id).plan).toBe('free');
    await bot.handle(cb(900, 'ok:1', { chat: { id: 900 }, message_id: 3, caption: 'chek' }));
    expect(activePlan(user.user.id).plan).toBe('week');
    expect(calls.some((c) => c.body.chat_id === '7' && String(c.body.text).includes('tasdiqlandi'))).toBe(true);
    // Ikkinchi marta bosish hech narsa o'zgartirmaydi.
    await bot.handle(cb(900, 'no:1'));
    expect(activePlan(user.user.id).plan).toBe('week');
  });

  it('welcome message has the app button and the Super offer', async () => {
    const { calls, bot } = setup();
    await bot.handle(msg(9, { text: '/start' }));
    const last = calls.at(-1)!;
    expect(last.body.text).toContain('Assalomu alaykum');
    expect(JSON.stringify(last.body.reply_markup)).toContain('web_app');
  });

  it('asks to choose a plan before a receipt', async () => {
    const { calls, bot } = setup();
    await bot.handle(msg(8, { photo: [{ file_id: 'x' }] }));
    expect(calls.at(-1)!.body.text).toContain('tarifni tanlang');
  });
});
