import type { AiContent, AiPrompt } from './ai-provider.ts';
import type { AiRouteExecutionContext, AiRouteKey, AiRouteOperation, AiRoutePrepared } from './ai-routes.ts';
import { type TutorRequest, buildContents, parseTutorRequest, SAFETY, systemInstruction } from './tutor.ts';
import {
  cleanFeedback,
  cleanMemory,
  feedbackBody,
  memoryBody,
  parseFeedbackRequest,
  parseMemoryRequest,
  parseSttRequest,
  parseTranslateRequest,
  ttsText,
  translateBody,
  type FeedbackRequest,
  type MemoryRequest,
  type SttRequest,
  type TranslateRequest,
} from './voice.ts';
import type { AiUsage } from './ai-quota.ts';

const TEXT_MODEL_FOR_PROMPT_SHAPING = '';
const ZERO_USAGE = Object.freeze({ requests: 1, tokens: 0, sttAudioSeconds: 0, ttsCharacters: 0, ttsAudioSeconds: 0 });

function withUsage(tokens: number, extras: Partial<AiUsage> = {}): AiUsage {
  return Object.freeze({ ...ZERO_USAGE, tokens: Math.max(0, Math.ceil(tokens)), ...extras });
}

function textLength(value: string): number {
  return Math.ceil(value.length / 4);
}

function promptFromLegacyBody(body: Record<string, unknown>): AiPrompt {
  const rawInstruction = body.systemInstruction as { parts?: Array<{ text?: unknown }> } | undefined;
  const systemInstruction = rawInstruction?.parts?.find((part) => typeof part.text === 'string')?.text;
  const rawContents = Array.isArray(body.contents) ? body.contents : [];
  const contents: AiContent[] = rawContents.map((raw) => {
    const item = raw as { role?: unknown; parts?: Array<{ text?: unknown }> };
    if (item.role !== 'user' && item.role !== 'model') throw new Error('Invalid minimized prompt role');
    const parts = (item.parts ?? []).filter((part) => typeof part?.text === 'string').map((part) => ({ text: part.text as string }));
    if (!parts.length) throw new Error('Invalid minimized prompt content');
    return { role: item.role, parts };
  });
  if (!contents.length) throw new Error('Empty minimized prompt');
  return Object.freeze({
    ...(typeof systemInstruction === 'string' ? { systemInstruction } : {}),
    contents: Object.freeze(contents),
    ...(body.generationConfig && typeof body.generationConfig === 'object'
      ? { generationConfig: Object.freeze({ ...(body.generationConfig as Record<string, unknown>) }) }
      : {}),
    ...(Array.isArray(body.safetySettings) ? { safetySettings: Object.freeze(body.safetySettings as Readonly<Record<string, unknown>>[]) } : {}),
  });
}

function tutorPrompt(request: TutorRequest): AiPrompt {
  const generationConfig = {
    temperature: request.character === 'witty' || request.character === 'adult' ? 0.95 : 0.85,
    topP: 0.95,
    maxOutputTokens: request.mode === 'voice' ? 320 : 700,
  };
  return Object.freeze({
    systemInstruction: systemInstruction(request),
    contents: Object.freeze(buildContents(request).map((item) => Object.freeze({
      role: item.role,
      parts: Object.freeze(item.parts.map((part) => Object.freeze({ text: part.text }))),
    }))),
    generationConfig: Object.freeze(generationConfig),
    safetySettings: SAFETY,
  });
}

function operation<T>(options: {
  readonly maxBodyBytes: number;
  readonly parse: (body: unknown) => T | string;
  readonly minimize: (input: T) => unknown;
  readonly estimateUsage: (input: T) => AiUsage;
  readonly sanitizeResult?: (result: unknown) => unknown;
}): AiRouteOperation {
  return Object.freeze({
    maxBodyBytes: options.maxBodyBytes,
    prepare(body: unknown): AiRoutePrepared | string {
      const input = options.parse(body);
      if (typeof input === 'string') return input;
      return Object.freeze({ input, usage: options.estimateUsage(input) });
    },
    minimize(input: unknown): unknown {
      return options.minimize(input as T);
    },
    async run(_input: unknown, context: AiRouteExecutionContext) {
      const providerResult = await context.providerCall();
      return { status: 200, body: options.sanitizeResult ? options.sanitizeResult(providerResult) : providerResult };
    },
  });
}

const disabledLiveOperation: AiRouteOperation = Object.freeze({
  maxBodyBytes: 0,
  prepare: () => 'Live is disabled',
  minimize: () => null,
  run: async () => ({ status: 503, body: { code: 'live_disabled' } }),
});

/**
 * Route-specific data boundaries for all six non-Live AI endpoints. These operations are supplied
 * to the route factory for accurate tests, but production readiness remains hard-disabled.
 */
export function createAiRouteOperations(): Readonly<Record<AiRouteKey, AiRouteOperation>> {
  const tutor = operation<TutorRequest>({
    maxBodyBytes: 64 * 1024,
    parse: parseTutorRequest,
    minimize: tutorPrompt,
    estimateUsage: (input) => withUsage(
      textLength(input.message) + input.history.reduce((sum, turn) => sum + textLength(turn.text), 0)
        + input.context.words.reduce((sum, word) => sum + textLength(word), 0)
        + input.context.mistakes.reduce((sum, mistake) => sum + textLength(mistake), 0)
        + textLength(input.context.memory) + 700,
    ),
  });
  const feedback = operation<FeedbackRequest>({
    maxBodyBytes: 128 * 1024,
    parse: parseFeedbackRequest,
    minimize: (input) => promptFromLegacyBody(feedbackBody(input, TEXT_MODEL_FOR_PROMPT_SHAPING)),
    estimateUsage: (input) => withUsage(2 * (input.turns.reduce((sum, turn) => sum + turn.text.length, 0) + 500)),
    sanitizeResult: cleanFeedback,
  });
  const translation = operation<TranslateRequest>({
    maxBodyBytes: 8 * 1024,
    parse: parseTranslateRequest,
    minimize: (input) => promptFromLegacyBody(translateBody(input, TEXT_MODEL_FOR_PROMPT_SHAPING)),
    estimateUsage: (input) => withUsage(2 * (input.text.length + input.context.length + 300)),
  });
  const memory = operation<MemoryRequest>({
    maxBodyBytes: 64 * 1024,
    parse: parseMemoryRequest,
    minimize: (input) => promptFromLegacyBody(memoryBody(input, TEXT_MODEL_FOR_PROMPT_SHAPING)),
    estimateUsage: (input) => withUsage(2 * (input.memory.length + input.turns.reduce((sum, turn) => sum + turn.text.length, 0) + 500)),
    sanitizeResult: cleanMemory,
  });
  const stt = operation<SttRequest>({
    maxBodyBytes: 4 * 1024 * 1024,
    parse: (body) => {
      const parsed = parseSttRequest(body);
      if (typeof parsed === 'string') return parsed;
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(parsed.audio) || parsed.audio.length % 4 !== 0) return 'Invalid audio data';
      return parsed;
    },
    minimize: (input) => Object.freeze({
      audio: Uint8Array.from(Buffer.from(input.audio, 'base64')),
      // The provider contract requires a single explicit language; auto currently uses Uzbek.
      languageCode: input.hint === 'fr' ? 'fr-FR' : 'uz-UZ',
    }),
    estimateUsage: (input) => withUsage(0, {
      sttAudioSeconds: Math.min(60, Math.max(1, Math.ceil((input.audio.length * 3 / 4) / 32_000))),
    }),
    sanitizeResult: (result) => {
      const raw = (result ?? {}) as { segments?: Array<{ alternatives?: Array<{ transcript?: unknown }> }> };
      const text = (raw.segments ?? []).flatMap((segment) => segment.alternatives ?? [])
        .map((alternative) => typeof alternative.transcript === 'string' ? alternative.transcript : '')
        .filter(Boolean).join(' ').slice(0, 4000);
      return { text };
    },
  });
  const tts = operation<{ text: string }>({
    maxBodyBytes: 8 * 1024,
    parse: (body) => {
      if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Invalid TTS request';
      const text = ttsText((body as Record<string, unknown>).text);
      return text ? { text } : 'Empty TTS request';
    },
    minimize: (input) => Object.freeze({ text: input.text }),
    estimateUsage: (input) => withUsage(0, { ttsCharacters: input.text.length }),
  });

  return Object.freeze({
    'POST /api/tutor': tutor,
    'POST /api/tutor/feedback': feedback,
    'POST /api/live/token': disabledLiveOperation,
    'POST /api/translate': translation,
    'POST /api/tutor/memory': memory,
    'POST /api/stt': stt,
    'POST /api/tts': tts,
  });
}
