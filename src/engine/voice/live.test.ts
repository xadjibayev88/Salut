import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveSession, type LiveOptions } from './live';

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
});
