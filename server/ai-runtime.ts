// Production wiring: env → verified Google provider config, and the single upstream-call hook used by
// the gated AI routes. Every value is explicit; anything missing keeps the provider unavailable.
import type { AiPrompt, AiProvider, AiProviderName, SynthesisRequest, TranscriptionRequest } from './ai-provider.ts';
import type { AiRouteKey } from './ai-routes.ts';
import type { GoogleCloudProviderConfig } from './google-cloud-provider.ts';

/** Default Gemini TTS delivery note: warm, natural Tashkent Uzbek; French phrases in clear French. */
export const DEFAULT_TTS_STYLE =
  "Read the following as Vivi, a warm, playful young tutor. Speak natural, fluent Tashkent Uzbek (Latin script) at a relaxed conversational pace with friendly intonation; pronounce any French words and sentences with clear native French pronunciation. Do not read this instruction aloud:";

function exactTrue(value: string | undefined): boolean {
  return value === 'true';
}

export function googleProviderConfigFromEnv(env: NodeJS.ProcessEnv): GoogleCloudProviderConfig {
  const projectVerified = exactTrue(env.VIVI_AI_PROJECT_CONFIG_VERIFIED);
  return Object.freeze({
    provider: env.VIVI_AI_PROVIDER,
    projectId: env.GOOGLE_CLOUD_PROJECT_ID,
    projectAccessVerified: projectVerified,
    text: Object.freeze({ model: env.VIVI_AI_MODEL, location: env.GOOGLE_CLOUD_LOCATION, verified: projectVerified }),
    speechToText: Object.freeze({
      model: env.VIVI_STT_MODEL ?? 'chirp_2',
      recognizer: env.VIVI_STT_RECOGNIZER ?? '_',
      locations: Object.freeze({
        'uz-UZ': env.VIVI_STT_LOCATION_UZ ?? 'asia-southeast1',
        'fr-FR': env.VIVI_STT_LOCATION_FR ?? 'europe-west4',
      }),
      verified: exactTrue(env.VIVI_STT_VERIFIED),
    }),
    textToSpeech: Object.freeze({
      model: env.VIVI_TTS_MODEL ?? 'gemini-3.8-flash-tts',
      location: env.VIVI_TTS_LOCATION ?? 'global',
      voice: env.VIVI_TTS_VOICE ?? 'Leda',
      style: env.VIVI_TTS_STYLE === 'off' ? undefined : env.VIVI_TTS_STYLE || DEFAULT_TTS_STYLE,
      verified: exactTrue(env.VIVI_TTS_VERIFIED),
    }),
  });
}

/** Route → provider method. Text routes use JSON mode (each prompt carries its own response schema). */
export function createProviderCall(provider: AiProvider) {
  return async (route: AiRouteKey, providerName: AiProviderName, payload: unknown, signal: AbortSignal): Promise<unknown> => {
    if (!provider.serviceNames.includes(providerName)) throw new Error('provider identity mismatch');
    switch (route) {
      case 'POST /api/tutor':
      case 'POST /api/tutor/feedback':
      case 'POST /api/translate':
      case 'POST /api/tutor/memory':
        return provider.generateJson(payload as AiPrompt, signal);
      case 'POST /api/stt':
        return provider.transcribe(payload as TranscriptionRequest, signal);
      case 'POST /api/tts':
        return provider.synthesize(payload as SynthesisRequest, signal);
      default:
        throw new Error('route has no provider call');
    }
  };
}
