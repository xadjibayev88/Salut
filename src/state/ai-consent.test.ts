import { describe, expect, it } from 'vitest';
import { AI_SCOPE_OPTIONS, SIGNUP_CORE_SCOPES, SIGNUP_OPTIONAL_SCOPES, signupGrants, type AiGrant } from './ai-consent';

const geminiApi: AiGrant[] = AI_SCOPE_OPTIONS.map(({ scope }) => ({ scope, provider: 'google-gemini-api' }));

describe('signup AI consent', () => {
  it('covers every AI scope exactly once between the core and optional groups', () => {
    const all = [...SIGNUP_CORE_SCOPES, ...SIGNUP_OPTIONAL_SCOPES].sort();
    expect(all).toEqual(AI_SCOPE_OPTIONS.map((o) => o.scope).sort());
  });

  it('grants only text scopes when the optional voice/memory toggle is off', () => {
    const grants = signupGrants(geminiApi, false);
    expect(grants.map((g) => g.scope).sort()).toEqual([...SIGNUP_CORE_SCOPES].sort());
    expect(grants.some((g) => g.scope === 'microphone_stt' || g.scope === 'live_session' || g.scope === 'memory')).toBe(false);
  });

  it('adds microphone, live and memory only when the learner opts in, with the server provider', () => {
    const grants = signupGrants(geminiApi, true);
    expect(grants).toHaveLength(AI_SCOPE_OPTIONS.length);
    expect(grants.every((g) => g.provider === 'google-gemini-api')).toBe(true);
  });
});
