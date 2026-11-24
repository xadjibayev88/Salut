export type AiProvider = 'google-agent-platform';
export type AiModel = 'gemini-3.5-flash-lite';
export type AiLocation = 'asia-southeast1' | 'europe-west4';

export interface AiQuotaConfig {
  readonly requestsPerDay: number | null;
  readonly tokensPerDay: number | null;
  readonly sttAudioSecondsPerDay: number | null;
  readonly ttsCharactersPerDay: number | null;
  readonly spendUsdPerDay: number | null;
}

export interface AiRuntimeConfig {
  /** Effective gate used by the server route registry. */
  readonly providerEnabled: boolean;
  /** Google Agent Platform Live has no approved transport/POC in this task. */
  readonly liveEnabled: false;
  readonly provider: AiProvider | null;
  readonly model: AiModel | null;
  readonly location: AiLocation | null;
  readonly credentialsPresent: boolean;
  readonly projectConfigured: boolean;
  readonly verification: Readonly<{
    provider: boolean;
    model: boolean;
    location: boolean;
    projectAccess: boolean;
  }>;
  readonly quota: Readonly<AiQuotaConfig>;
  readonly killSwitchActive: boolean;
  /** Inputs are complete and explicitly verified, excluding the kill switch/adapter. */
  readonly configurationReady: boolean;
}

const VERIFIED_PROVIDERS = new Set<string>(['google-agent-platform']);
const VERIFIED_MODELS = new Set<string>(['gemini-3.5-flash-lite']);
// These locations are documented in the approved design as candidate Google Cloud regions.
// They are not proof of model access: project-specific availability must be attested separately.
const VERIFIED_LOCATION_CANDIDATES = new Set<string>(['asia-southeast1', 'europe-west4']);
// Task 1 adds the gate, not the Google Cloud transport. The provider stays disabled until a later
// task implements and tests the server-only adapter; environment values cannot bypass this switch.
const GOOGLE_PROVIDER_TRANSPORT_READY = false;

function exactTrue(value: string | undefined): boolean {
  return value === 'true';
}

function positiveInteger(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function positiveDecimal(value: string | undefined): number | null {
  if (!value || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseQuota(env: NodeJS.ProcessEnv): Readonly<AiQuotaConfig> {
  return Object.freeze({
    requestsPerDay: positiveInteger(env.VIVI_AI_MAX_REQUESTS_PER_DAY),
    tokensPerDay: positiveInteger(env.VIVI_AI_MAX_TOKENS_PER_DAY),
    sttAudioSecondsPerDay: positiveInteger(env.VIVI_AI_MAX_STT_AUDIO_SECONDS_PER_DAY),
    ttsCharactersPerDay: positiveInteger(env.VIVI_AI_MAX_TTS_CHARACTERS_PER_DAY),
    spendUsdPerDay: positiveDecimal(env.VIVI_AI_MAX_SPEND_USD_PER_DAY),
  });
}

function allQuotaValuesPositive(quota: Readonly<AiQuotaConfig>): boolean {
  return Object.values(quota).every((value) => typeof value === 'number' && value > 0);
}

/**
 * Parse the server-only AI configuration. Any missing, malformed, or unverified value fails closed.
 * Credential and project readiness are booleans only; secret values and credential paths are never
 * copied into this object. Live is deliberately hard-disabled regardless of environment input.
 */
export function loadAiRuntimeConfig(env: NodeJS.ProcessEnv): AiRuntimeConfig {
  const rawProvider = env.VIVI_AI_PROVIDER;
  const rawModel = env.VIVI_AI_MODEL;
  const rawLocation = env.GOOGLE_CLOUD_LOCATION;
  const provider = rawProvider && VERIFIED_PROVIDERS.has(rawProvider) ? (rawProvider as AiProvider) : null;
  const model = rawModel && VERIFIED_MODELS.has(rawModel) ? (rawModel as AiModel) : null;
  const location = rawLocation && VERIFIED_LOCATION_CANDIDATES.has(rawLocation) ? (rawLocation as AiLocation) : null;
  const credentialsPresent = exactTrue(env.GOOGLE_CLOUD_ADC_CONFIGURED);
  const projectConfigured = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(env.GOOGLE_CLOUD_PROJECT_ID ?? '');
  const projectAccessVerified = exactTrue(env.VIVI_AI_PROJECT_CONFIG_VERIFIED);
  const verification = Object.freeze({
    provider: provider !== null,
    model: model !== null && projectAccessVerified,
    location: location !== null && projectAccessVerified,
    projectAccess: projectConfigured && projectAccessVerified,
  });
  const quota = parseQuota(env);
  const killSwitchActive = env.VIVI_AI_KILL_SWITCH !== 'off';
  const configurationReady =
    exactTrue(env.VIVI_AI_ENABLED) &&
    provider !== null &&
    model !== null &&
    location !== null &&
    credentialsPresent &&
    projectConfigured &&
    projectAccessVerified &&
    allQuotaValuesPositive(quota);

  return Object.freeze({
    providerEnabled: configurationReady && !killSwitchActive && GOOGLE_PROVIDER_TRANSPORT_READY,
    liveEnabled: false,
    provider,
    model,
    location,
    credentialsPresent,
    projectConfigured,
    verification,
    quota,
    killSwitchActive,
    configurationReady,
  });
}
