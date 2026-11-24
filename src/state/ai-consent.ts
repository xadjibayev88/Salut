import { accountApi } from './account';

export const AI_CONSENT_POLICY_VERSION = '2026-11-24-v1';

export type AiScope =
  | 'text_tutor'
  | 'text_feedback'
  | 'live_session'
  | 'translation'
  | 'memory'
  | 'microphone_stt'
  | 'text_tts';
export type AiProviderName = 'google-agent-platform' | 'google-cloud-speech-to-text';
export interface AiGrant {
  scope: AiScope;
  provider: AiProviderName;
}
export interface AiGrantRecord extends AiGrant {
  policyVersion: string;
  grantedAt: number;
  revokedAt: number | null;
}
export interface AiConsent {
  policyVersion: string;
  grants: AiGrantRecord[];
  grantedAt: number;
  revokedAt: number | null;
}
export interface AiConsentResponse {
  policyVersion: string;
  consent: AiConsent | null;
}

export const AI_SCOPE_OPTIONS: readonly {
  scope: AiScope;
  provider: AiProviderName;
  label: string;
  detail: string;
  providerLabel: string;
}[] = [
  {
    scope: 'text_tutor',
    provider: 'google-agent-platform',
    label: 'Vivi bilan matnli fransuz tili mashqi',
    detail: 'Yozgan xabaringiz va kerakli A1–C2 mashq konteksti yuboriladi.',
    providerLabel: 'Google Cloud Agent Platform (Gemini)',
  },
  {
    scope: 'text_feedback',
    provider: 'google-agent-platform',
    label: 'Javob va mashq bo‘yicha fikr-mulohaza',
    detail: 'Siz tasdiqlagan javob va unga tegishli mashq konteksti yuboriladi.',
    providerLabel: 'Google Cloud Agent Platform (Gemini)',
  },
  {
    scope: 'live_session',
    provider: 'google-agent-platform',
    label: 'Jonli AI suhbat sessiyasi',
    detail: 'Sessiya metama’lumotlari yuborilishi mumkin. Live hozir o‘chiq; bu checkbox uni yoqmaydi.',
    providerLabel: 'Google Cloud Agent Platform',
  },
  {
    scope: 'translation',
    provider: 'google-agent-platform',
    label: 'Fransuzcha matn tarjimasi',
    detail: 'Faqat tarjima uchun zarur bo‘lgan matn yuboriladi.',
    providerLabel: 'Google Cloud Agent Platform (Gemini)',
  },
  {
    scope: 'memory',
    provider: 'google-agent-platform',
    label: 'Vivi xotirasini yaratish yoki yangilash',
    detail: 'Faqat siz ko‘rib, saqlashni tasdiqlagan o‘quvchi konteksti yuboriladi.',
    providerLabel: 'Google Cloud Agent Platform (Gemini)',
  },
  {
    scope: 'microphone_stt',
    provider: 'google-cloud-speech-to-text',
    label: 'Mikrofon yozuvini matnga aylantirish',
    detail: 'Yozib olingan asl audio Cloud Speech-to-Text xizmatiga yuboriladi.',
    providerLabel: 'Google Cloud Speech-to-Text',
  },
  {
    scope: 'text_tts',
    provider: 'google-agent-platform',
    label: 'Vivi javobini ovozlashtirish',
    detail: 'Vivi javobining matni ovoz yaratish uchun yuboriladi.',
    providerLabel: 'Google Cloud Agent Platform (Gemini TTS)',
  },
];

export async function loadAiConsent(): Promise<{ ok: boolean; status: number; body: AiConsentResponse }> {
  return accountApi<AiConsentResponse>('ai/consent');
}

export async function saveAiConsent(policyVersion: string, grants: AiGrant[]) {
  return accountApi<AiConsentResponse>('ai/consent', {
    method: 'PUT',
    body: JSON.stringify({ policyVersion, grants }),
  });
}

export async function revokeAiConsentRequest() {
  return accountApi<{ consent: AiConsent | null }>('ai/consent', { method: 'DELETE' });
}

export async function deleteAiMemoryRequest() {
  return accountApi<{ deleted: boolean }>('ai/memory', { method: 'DELETE' });
}
