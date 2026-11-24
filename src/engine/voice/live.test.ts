import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveSession, type LiveOptions } from './live';

import type { SttResult } from './stt-result';

const options = (inputMode: LiveOptions['inputMode']): LiveOptions => ({
  character: 'classic',
  role: 'free',
  customRole: '',
  explicit: false,
  lang: 'uz',
  inputMode,
  context: () => ({}),
});

const internals = (session: LiveSession) => session as unknown as {
  vad: { on: boolean; ptt: boolean };
  ws: WebSocket | null;
  sendAudio: (pcm: Uint8Array) => void;
  vadStep: (rms: number, chunkMs: number, pcm: Uint8Array) => void;
};

beforeEach(() => {
  vi.stubGlobal('WebSocket', { OPEN: 1 });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => vi.unstubAllGlobals());

describe('Gemini Live input mode', () => {
  it('does not auto-open or send audio in PTT mode until deliberately activated', () => {
    const session = new LiveSession(options('ptt'));
    session.snap = { ...session.snap, phase: 'listening' };
    const inner = internals(session);
    inner.ws = { readyState: 1, send: vi.fn() } as unknown as WebSocket;
    const sendAudio = vi.fn();
    inner.sendAudio = sendAudio;
    const pcm = new Uint8Array([1, 2]);

    inner.vadStep(0.5, 100, pcm);
    expect(inner.vad.on).toBe(false);
    expect(sendAudio).not.toHaveBeenCalled();

    session.togglePushToTalk();
    expect(inner.vad.on).toBe(true);
    expect(inner.vad.ptt).toBe(true);
    inner.vadStep(0.5, 100, pcm);
    expect(sendAudio).toHaveBeenCalledOnce();

    session.togglePushToTalk();
    expect(inner.vad.on).toBe(false);
    expect(inner.vad.ptt).toBe(false);
  });

  it('keeps automatic voice activity detection in hands-free mode', () => {
    const session = new LiveSession(options('handsfree'));
    session.snap = { ...session.snap, phase: 'listening' };
    const inner = internals(session);
    inner.ws = { readyState: 1, send: vi.fn() } as unknown as WebSocket;

    inner.vadStep(0.1, 100, new Uint8Array([1]));
    inner.vadStep(0.1, 100, new Uint8Array([1]));

    expect(inner.vad.on).toBe(true);
    expect(inner.vad.ptt).toBe(false);
  });

  const frenchResult: SttResult = { text: 'Je vais au marché', detectedLanguage: 'fr-FR', confidence: 0.9, alternatives: [], reviewReasons: [] };
  const review = (result: SttResult, userConfirmed = true, confirmedText = 'Je vais au marché') => ({
    sttResult: result,
    userConfirmed,
    confirmedText,
  });
  const blockedReviews = [
    { name: 'missing review', value: undefined },
    { name: 'unconfirmed French', value: review(frenchResult, false) },
    { name: 'empty confirmation', value: review(frenchResult, true, '   ') },
    { name: 'Uzbek language', value: review({ text: 'Men tayyorman', detectedLanguage: 'uz-UZ', alternatives: [], reviewReasons: [] }) },
    { name: 'unknown language', value: review({ text: 'Salut', detectedLanguage: 'unknown', alternatives: [], reviewReasons: ['language_unknown'] }) },
    { name: 'mixed language', value: review({ text: 'Men vais au marché', detectedLanguage: 'unknown', alternatives: [], reviewReasons: ['code_switch'] }) },
    { name: 'code-switch reason even with French label', value: review({ ...frenchResult, reviewReasons: ['code_switch'] }) },
    { name: 'language mismatch', value: review({ ...frenchResult, reviewReasons: ['language_mismatch'] }) },
    { name: 'missing confidence review reason', value: review({ ...frenchResult, reviewReasons: ['confidence_missing'] }) },
    { name: 'conflicting alternatives review reason', value: review({ ...frenchResult, reviewReasons: ['alternatives_conflict'] }) },
    { name: 'possible noise review reason', value: review({ ...frenchResult, reviewReasons: ['possible_noise'] }) },
    { name: 'target phrase mismatch review reason', value: review({ ...frenchResult, reviewReasons: ['target_phrase_mismatch'] }) },
    { name: 'unknown runtime review reason', value: review({ ...frenchResult, reviewReasons: ['future_unknown_reason'] as unknown as SttResult['reviewReasons'] }) },
    { name: 'malformed runtime review reasons', value: review({ ...frenchResult, reviewReasons: null as unknown as SttResult['reviewReasons'] }) },
    { name: 'confirmed text differs from reviewed transcript', value: review(frenchResult, true, 'Je mange une pomme') },
    { name: 'empty STT result', value: review({ ...frenchResult, text: '', reviewReasons: ['empty_transcript'] }) },
  ];

  it.each(blockedReviews)('blocks $name before token, microphone, and WebSocket access', async ({ value }) => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ token: 'mock-token' }), { status: 200 }));
    const getUserMedia = vi.fn(async () => { throw new Error('mock microphone only'); });
    const WebSocketMock = Object.assign(vi.fn(), { OPEN: 1 });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    vi.stubGlobal('WebSocket', WebSocketMock);
    const session = new LiveSession({ ...options('ptt'), ...(value ? { reviewedTranscript: value } : {}) } as LiveOptions);

    await session.start();

    expect(session.snap.phase).toBe('ended');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(WebSocketMock).not.toHaveBeenCalled();
  });

  it('allows only a non-empty, explicitly confirmed French transcript past the Live entry guard', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ token: 'mock-token' }), { status: 200 }));
    const getUserMedia = vi.fn(async () => { throw new Error('mock microphone only'); });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    const session = new LiveSession({
      ...options('ptt'),
      reviewedTranscript: review(frenchResult),
    } as LiveOptions);

    await session.start();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(session.snap.phase).toBe('ended');
  });
});
