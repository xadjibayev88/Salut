import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { LIVE_DISABLED_MESSAGE, LiveSession, type LiveOptions } from './live';
import type { SttResult } from './stt-result';

const options = (inputMode: LiveOptions['inputMode'], context = vi.fn(() => ({}))): LiveOptions => ({
  character: 'classic',
  role: 'free',
  customRole: '',
  explicit: false,
  lang: 'uz',
  inputMode,
  context,
});

afterEach(() => vi.unstubAllGlobals());

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

describe('disabled Live client', () => {
  it.each(blockedReviews)('blocks $name without token, microphone, WebSocket, or context access', async ({ value }) => {
    const fetchMock = vi.fn();
    const getUserMedia = vi.fn();
    const WebSocketMock = vi.fn();
    const context = vi.fn(() => ({}));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    vi.stubGlobal('WebSocket', WebSocketMock);
    const session = new LiveSession({
      ...options('ptt', context),
      ...(value ? { reviewedTranscript: value } : {}),
    } as LiveOptions);

    await session.start();

    expect(session.snap.phase).toBe('ended');
    expect(session.snap.error).toBe(LIVE_DISABLED_MESSAGE);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(WebSocketMock).not.toHaveBeenCalled();
    expect(context).not.toHaveBeenCalled();
  });

  it('keeps Live disabled even for an otherwise valid, confirmed French transcript', async () => {
    const fetchMock = vi.fn();
    const getUserMedia = vi.fn();
    const WebSocketMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    vi.stubGlobal('WebSocket', WebSocketMock);
    const session = new LiveSession({ ...options('handsfree'), reviewedTranscript: review(frenchResult) });

    await session.start();

    expect(session.snap.error).toBe(LIVE_DISABLED_MESSAGE);
    expect(session.snap.turns).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(WebSocketMock).not.toHaveBeenCalled();
  });

  it('contains no legacy browser Live transport and exposes the ordinary lesson fallback', () => {
    const source = readFileSync(new URL('./live.ts', import.meta.url), 'utf8');
    const screen = readFileSync(new URL('../../screens/voice/LiveCall.tsx', import.meta.url), 'utf8');
    const hub = readFileSync(new URL('../../screens/voice/VoiceHub.tsx', import.meta.url), 'utf8');
    expect(source).not.toContain('./api/live/token');
    expect(source).not.toContain('access_token=');
    expect(source).not.toContain('generativelanguage.googleapis.com');
    expect(source).not.toContain('new WebSocket(');
    expect(screen).toContain('Darslarga qaytish');
    expect(hub).toContain("prefs.live && config.live ? 'live' : 'call'");
  });
});
