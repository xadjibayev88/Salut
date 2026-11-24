import { describe, expect, it } from 'vitest';
import { loadAiRuntimeConfig, type AiRuntimeConfig } from './ai-config.ts';

const completeEnv: NodeJS.ProcessEnv = {
  VIVI_AI_ENABLED: 'true',
  VIVI_AI_PROVIDER: 'google-agent-platform',
  VIVI_AI_MODEL: 'gemini-3.5-flash-lite',
  GOOGLE_CLOUD_PROJECT_ID: 'voila-ai-project',
  GOOGLE_CLOUD_LOCATION: 'asia-southeast1',
  GOOGLE_CLOUD_ADC_CONFIGURED: 'true',
  VIVI_AI_PROJECT_CONFIG_VERIFIED: 'true',
  VIVI_AI_KILL_SWITCH: 'off',
  VIVI_AI_MAX_REQUESTS_PER_DAY: '1000',
  VIVI_AI_MAX_TOKENS_PER_DAY: '100000',
  VIVI_AI_MAX_STT_AUDIO_SECONDS_PER_DAY: '3600',
  VIVI_AI_MAX_TTS_CHARACTERS_PER_DAY: '50000',
  VIVI_AI_MAX_SPEND_USD_PER_DAY: '1.25',
};

function expectDisabled(overrides: NodeJS.ProcessEnv, reason: string) {
  it(`fails closed when ${reason}`, () => {
    const config = loadAiRuntimeConfig({ ...completeEnv, ...overrides });
    expect(config.providerEnabled).toBe(false);
  });
}

describe('loadAiRuntimeConfig', () => {
  expectDisabled({ VIVI_AI_ENABLED: undefined }, 'the provider flag is missing');
  expectDisabled({ GOOGLE_CLOUD_ADC_CONFIGURED: undefined }, 'server-side credentials are not configured');
  expectDisabled({ VIVI_AI_MAX_REQUESTS_PER_DAY: undefined }, 'a quota is missing');
  expectDisabled({ VIVI_AI_MODEL: 'unverified-model' }, 'the model is not verified');
  expectDisabled({ GOOGLE_CLOUD_LOCATION: 'moon-1' }, 'the location is not verified');
  expectDisabled({ VIVI_AI_PROJECT_CONFIG_VERIFIED: 'false' }, 'project/model/location access has not been verified');
  expectDisabled({ VIVI_AI_MAX_SPEND_USD_PER_DAY: '0' }, 'the positive spend allowance is missing');
  expectDisabled({ VIVI_AI_MAX_TOKENS_PER_DAY: '-1' }, 'a quota is negative');
  expectDisabled({ VIVI_AI_KILL_SWITCH: 'on' }, 'the emergency kill switch is active');

  it('keeps Live disabled even when the environment requests it', () => {
    const config = loadAiRuntimeConfig({ ...completeEnv, VIVI_AI_LIVE_ENABLED: 'true' });
    expect(config.liveEnabled).toBe(false);
    expect(config.providerEnabled).toBe(false);
  });

  it('accepts only the named Google provider and verified model/location candidates', () => {
    const config = loadAiRuntimeConfig(completeEnv);
    expect(config.provider).toBe('google-agent-platform');
    expect(config.model).toBe('gemini-3.5-flash-lite');
    expect(config.location).toBe('asia-southeast1');
    expect(config.credentialsPresent).toBe(true);
    expect(config.configurationReady).toBe(true);
  });

  it('keeps the provider disabled until its Google transport is implemented', () => {
    const config: AiRuntimeConfig = loadAiRuntimeConfig(completeEnv);
    expect(config.configurationReady).toBe(true);
    expect(config.providerEnabled).toBe(false);
  });

  it('does not enable a provider for truthy-looking but invalid flags or malformed numeric values', () => {
    expect(loadAiRuntimeConfig({ ...completeEnv, VIVI_AI_ENABLED: 'yes' }).providerEnabled).toBe(false);
    expect(loadAiRuntimeConfig({ ...completeEnv, VIVI_AI_MAX_REQUESTS_PER_DAY: '1e6' }).providerEnabled).toBe(false);
    expect(loadAiRuntimeConfig({ ...completeEnv, VIVI_AI_MAX_SPEND_USD_PER_DAY: ' 1.25 ' }).providerEnabled).toBe(false);
  });

  it('returns a deeply immutable server-only snapshot without credential values', () => {
    const config = loadAiRuntimeConfig({ ...completeEnv, GOOGLE_APPLICATION_CREDENTIALS: '/secret/service-account.json' });
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.quota)).toBe(true);
    expect(JSON.stringify(config)).not.toContain('service-account.json');
    expect(JSON.stringify(config)).not.toContain('GOOGLE_APPLICATION_CREDENTIALS');
  });
});
