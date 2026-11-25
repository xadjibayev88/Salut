import { describe, expect, it, vi } from 'vitest';
import { createGeminiApiProvider, GEMINI_API_BASE } from './gemini-api-provider.ts';
import { loadAiRuntimeConfig } from './ai-config.ts';
import { aiProviderMode, policyVersionFor, routeRequirementsFor } from './ai-consent.ts';
import { geminiApiProviderConfigFromEnv } from './ai-runtime.ts';

const KEY = 'AIzaSyTEST_key_0123456789abcdef';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const textReply = (value: unknown) => json({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] });

function provider(responses: Response[], overrides = {}) {
  const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => responses.shift() ?? json({}, 500));
  const p = createGeminiApiProvider({
    apiKey: KEY,
    textModels: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],
    ttsModels: ['gemini-3.8-flash-lite-tts'],
    voice: 'Leda',
    ...overrides,
  }, fetchImpl as unknown as typeof fetch);
  return { p, fetchImpl };
}

describe('Gemini API (free) provider', () => {
  it('sends the key only in the x-goog-api-key header and parses JSON replies', async () => {
    const { p, fetchImpl } = provider([textReply({ text: 'Bonjour !', cue: { state: 'speaking', face: 'happy' } })]);
    await expect(p.generateJson({ contents: [{ role: 'user', parts: [{ text: 'Salom' }] }] })).resolves.toMatchObject({ text: 'Bonjour !' });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${GEMINI_API_BASE}/gemini-3.5-flash-lite:generateContent`);
    expect(url).not.toContain(KEY);
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(KEY);
  });

  it('moves to the fallback model only after a 429 refusal, never after a processed error', async () => {
    const a = provider([json({}, 429), textReply({ uz: 'salom' })]);
    await expect(a.p.generateJson({ contents: [{ role: 'user', parts: [{ text: 'x' }] }] })).resolves.toEqual({ uz: 'salom' });
    expect(String(a.fetchImpl.mock.calls[1][0])).toContain('gemini-3.1-flash-lite');
    const b = provider([json({}, 500), textReply({ uz: 'salom' })]);
    await expect(b.p.generateJson({ contents: [{ role: 'user', parts: [{ text: 'x' }] }] })).rejects.toMatchObject({ code: 'upstream_error' });
    expect(b.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('refuses to call Google without a usable key', async () => {
    const { p, fetchImpl } = provider([], { apiKey: '' });
    await expect(p.generateJson({ contents: [{ role: 'user', parts: [{ text: 'x' }] }] })).rejects.toMatchObject({ code: 'auth_unavailable' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('transcribes browser audio with Gemini and tags mixed Uzbek/French for learner review', async () => {
    const { p, fetchImpl } = provider([textReply({ text: "Salom, je m'appelle Ali", language: 'mixed' })]);
    const result = await p.transcribe({ audio: new Uint8Array([1, 2, 3]), languageCode: 'uz-UZ', mimeType: 'audio/webm', autoLanguage: true });
    expect(result.segments[0].alternatives[0].transcript).toBe("Salom, je m'appelle Ali");
    expect(result.segments.map((s) => s.languageCode)).toEqual(['uz-UZ', 'fr-FR']);
    const body = JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.contents[0].parts[0].inlineData.mimeType).toBe('audio/webm');
  });

  it('wraps Gemini TTS PCM into WAV with the Uzbek delivery style', async () => {
    const pcm = Buffer.alloc(2400 * 2, 3);
    const { p, fetchImpl } = provider([
      json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: pcm.toString('base64') } }] } }] }),
    ], { style: 'Speak warm Uzbek:' });
    const out = await p.synthesize({ text: 'Salom!' });
    expect(Buffer.from(out.audio).toString('ascii', 0, 4)).toBe('RIFF');
    const body = JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.contents[0].parts[0].text).toBe('Speak warm Uzbek:\n\nSalom!');
    expect(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe('Leda');
    expect(String(fetchImpl.mock.calls[0][0])).toContain('gemini-3.8-flash-lite-tts');
  });
});

describe('free mode configuration and consent', () => {
  const quotas = Object.fromEntries([
    'REQUESTS', 'TOKENS', 'STT_AUDIO_SECONDS', 'TTS_CHARACTERS', 'TTS_AUDIO_SECONDS',
    'SUBJECT_REQUESTS', 'SUBJECT_TOKENS', 'SUBJECT_STT_AUDIO_SECONDS', 'SUBJECT_TTS_CHARACTERS', 'SUBJECT_TTS_AUDIO_SECONDS',
  ].map((k) => [`VIVI_AI_MAX_${k}_PER_DAY`, '100']));
  const freeEnv = {
    ...quotas,
    VIVI_AI_MAX_SPEND_USD_PER_DAY: '0.01',
    VIVI_AI_ENABLED: 'true',
    VIVI_AI_PROVIDER: 'google-gemini-api',
    VIVI_AI_MODEL: 'gemini-3.5-flash-lite',
    VIVI_AI_KILL_SWITCH: 'off',
    GEMINI_API_KEY: KEY,
  };

  it('enables with only an API key — no Cloud project, region, ADC or billing', () => {
    expect(loadAiRuntimeConfig(freeEnv).providerEnabled).toBe(true);
    expect(loadAiRuntimeConfig({ ...freeEnv, GEMINI_API_KEY: '' }).providerEnabled).toBe(false);
    expect(loadAiRuntimeConfig({ ...freeEnv, VIVI_AI_MODEL: 'gemini-9-ultra' }).providerEnabled).toBe(false);
    expect(loadAiRuntimeConfig({ ...freeEnv, VIVI_AI_KILL_SWITCH: 'on' }).providerEnabled).toBe(false);
  });

  it('uses its own provider identity and policy version so Cloud consent never covers it', () => {
    expect(aiProviderMode(freeEnv)).toBe('gemini-api');
    expect(aiProviderMode({})).toBe('vertex');
    expect(policyVersionFor('gemini-api')).not.toBe(policyVersionFor('vertex'));
    const free = routeRequirementsFor('gemini-api');
    expect(Object.values(free).every((r) => r.provider === 'google-gemini-api')).toBe(true);
    expect(routeRequirementsFor('vertex')['POST /api/stt'].provider).toBe('google-cloud-speech-to-text');
  });

  it('defaults to the lite TTS model and Leda voice, with a 429-only fallback text model', () => {
    const config = geminiApiProviderConfigFromEnv({ GEMINI_API_KEY: KEY });
    expect(config.textModels).toEqual(['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']);
    expect(config.ttsModels[0]).toBe('gemini-3.8-flash-lite-tts');
    expect(config.voice).toBe('Leda');
  });
});
