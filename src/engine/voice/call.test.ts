import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceCall, type CallOptions } from './call';
import type { SttResult, SttReviewReason } from './stt';

const result = (text: string, reviewReasons: SttReviewReason[] = []): SttResult => ({
  text,
  detectedLanguage: 'fr-FR',
  confidence: 0.82,
  alternatives: [],
  reviewReasons,
});

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

    await (call as unknown as { onFinal: (result: SttResult) => Promise<void> }).onFinal(result('  Salom, Vivi  ', ['confidence_missing']));

    expect(call.snap.phase).toBe('review');
    expect(call.snap.draft).toBe('Salom, Vivi');
    expect(call.snap.sttResult?.reviewReasons).toEqual(['confidence_missing']);
    expect(call.snap.turns).toEqual([]);
    call.dispose();
  });

  it('does not call the tutor or record a scored turn until the learner confirms the edited text', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ code: 'blocked', message: 'blocked' }), { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);
    const call = new VoiceCall(options());
    const onUserTurn = vi.fn();
    call.onUserTurn = onUserTurn;
    call.snap = { ...call.snap, phase: 'user' };

    await (call as unknown as { onFinal: (result: SttResult) => Promise<void> }).onFinal(result('Je m’appelle Ali', ['alternatives_conflict']));
    call.setDraft('Je m’appelle Alix');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onUserTurn).not.toHaveBeenCalled();
    expect(call.snap.turns).toEqual([]);

    call.submitDraft();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ message: 'Je m’appelle Alix' });
    expect(onUserTurn).toHaveBeenCalledOnce();
    expect(call.snap.turns.filter((turn) => turn.role === 'user').map((turn) => turn.text)).toEqual(['Je m’appelle Alix']);
    call.dispose();
  });

  it('re-record discards the unconfirmed transcript without tutor, scoring, correction, or memory effects', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const call = new VoiceCall(options());
    const onUserTurn = vi.fn();
    call.onUserTurn = onUserTurn;
    (call as unknown as { startedAt: number }).startedAt = Date.now();
    call.snap = { ...call.snap, phase: 'review', draft: 'Men suis prêt', turns: [], sttResult: result('Men suis prêt', ['code_switch']) };

    call.discardDraft();

    expect(call.snap.phase).toBe('ready');
    expect(call.snap.draft).toBe('');
    expect(call.snap.turns).toEqual([]);
    expect(onUserTurn).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    call.dispose();
  });

  it('cancel ends the call without submitting an unconfirmed transcript', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const call = new VoiceCall(options());
    const onUserTurn = vi.fn();
    call.onUserTurn = onUserTurn;
    call.snap = { ...call.snap, phase: 'review', draft: 'Je vais au marché', turns: [], sttResult: result('Je vais au marché') };

    call.cancelDraft();

    expect(call.snap.phase).toBe('ended');
    expect(call.snap.turns).toEqual([]);
    expect(onUserTurn).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    call.dispose();
  });

  it('uses only Cloud STT even if browser SpeechRecognition is present', () => {
    vi.stubGlobal('SpeechRecognition', class { start() {} stop() {} abort() {} });
    vi.stubGlobal('MediaRecorder', class { static isTypeSupported() { return true; } });
    const call = new VoiceCall({ ...options(), stt: 'browser', config: { ...options().config, stt: true } });

    (call as unknown as { setupStt: (pref: string) => void }).setupStt('browser');

    expect(call.snap.sttKind).toBe('cloud');
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
