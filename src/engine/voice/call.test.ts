import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceCall, type CallOptions } from './call';

const options = (): CallOptions => ({
  character: 'classic',
  role: 'free',
  customRole: '',
  lang: 'uz',
  voiceId: '',
  inputMode: 'ptt',
  stt: 'browser',
  micLang: 'uz-UZ',
  rate: 1,
  name: 'Ali',
  context: () => ({}),
  config: {
    ai: true,
    stt: false,
    tts: 'browser',
    audioTags: false,
    voices: [],
    sessionMinutes: 10,
    cooldownMinutes: 0,
  },
});

beforeEach(() => {
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('VoiceCall speech review', () => {
  it('keeps recognized speech editable instead of sending it immediately', async () => {
    const call = new VoiceCall(options());
    call.snap = { ...call.snap, phase: 'user' };

    await (call as unknown as { onFinal: (text: string) => Promise<void> }).onFinal('  Salom, Vivi  ');

    expect(call.snap.phase).toBe('review');
    expect(call.snap.draft).toBe('Salom, Vivi');
    expect(call.snap.turns).toEqual([]);
    call.dispose();
  });

  it('returns to review with the edited draft after a request failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: 'blocked', message: 'blocked' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    })));
    const call = new VoiceCall(options());
    call.snap = { ...call.snap, phase: 'review', draft: 'Boshlang\'ich matn' };

    call.setDraft('  Tahrirlangan matn  ');
    call.submitDraft();
    await vi.waitFor(() => expect(call.snap.phase).toBe('review'));

    expect(call.snap.draft).toBe('Tahrirlangan matn');
    expect(call.snap.turns.filter((turn) => turn.role === 'user').map((turn) => turn.text)).toEqual(['Tahrirlangan matn']);
    call.setDraft('Yana tahrirlangan');
    call.submitDraft();
    await vi.waitFor(() => expect(call.snap.phase).toBe('review'));
    expect(call.snap.turns.filter((turn) => turn.role === 'user').map((turn) => turn.text)).toEqual(['Yana tahrirlangan']);
    call.dispose();
  });

  it('does not restart a delayed retry after the user begins a newer turn', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => { throw new TypeError('network'); });
    vi.stubGlobal('fetch', fetchMock);
    const call = new VoiceCall(options());
    call.snap = { ...call.snap, phase: 'review', draft: 'Birinchi matn' };

    call.submitDraft();
    await Promise.resolve();
    await Promise.resolve();
    call.pressStart();
    await vi.advanceTimersByTimeAsync(700);

    expect(call.snap.phase).toBe('user');
    expect(fetchMock).toHaveBeenCalledOnce();
    call.dispose();
  });

  it('leaves thinking and preserves a retry after both request attempts time out', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      const abort = () => reject(new DOMException('Aborted', 'AbortError'));
      if (signal?.aborted) abort();
      else signal?.addEventListener('abort', abort, { once: true });
    })));
    const call = new VoiceCall(options());
    call.snap = { ...call.snap, phase: 'review', draft: 'Qayta tekshiriladigan matn' };

    call.submitDraft();
    await vi.advanceTimersByTimeAsync(18_000);

    expect(call.snap.phase).toBe('review');
    expect(call.snap.retryAvailable).toBe(true);
    expect(call.snap.draft).toBe('Qayta tekshiriladigan matn');
    call.dispose();
  });
});
