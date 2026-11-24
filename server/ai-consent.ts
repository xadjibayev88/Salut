import { db, tx } from './db.ts';

export const AI_CONSENT_POLICY_VERSION = '2026-11-24-v1' as const;

export type AiScope =
  | 'text_tutor'
  | 'text_feedback'
  | 'live_session'
  | 'translation'
  | 'memory'
  | 'microphone_stt'
  | 'text_tts';

/** Only the named Google services from the approved plan; arbitrary provider URLs are rejected. */
export type AiProviderName = 'google-agent-platform' | 'google-cloud-speech-to-text';

/** accounts.ts creates this only after validating a signed account session. */
export interface AiSubject {
  readonly kind: 'account';
  readonly userId: string;
}

export interface AiGrant {
  readonly scope: AiScope;
  readonly provider: AiProviderName;
}

export interface AiGrantRecord extends AiGrant {
  readonly policyVersion: string;
  readonly grantedAt: number;
  readonly revokedAt: number | null;
}

export interface AiConsent {
  readonly policyVersion: string;
  /** Includes each scope's current consent status and its own timestamps. */
  readonly grants: readonly AiGrantRecord[];
  readonly grantedAt: number;
  /** Null while any scope in the latest policy version remains active. */
  readonly revokedAt: number | null;
}

export interface AiRouteRequirement extends AiGrant {}

export const AI_ROUTE_REQUIREMENTS: Readonly<Record<string, AiRouteRequirement>> = Object.freeze({
  'POST /api/tutor': { scope: 'text_tutor', provider: 'google-agent-platform' },
  'POST /api/tutor/feedback': { scope: 'text_feedback', provider: 'google-agent-platform' },
  'POST /api/live/token': { scope: 'live_session', provider: 'google-agent-platform' },
  'POST /api/translate': { scope: 'translation', provider: 'google-agent-platform' },
  'POST /api/tutor/memory': { scope: 'memory', provider: 'google-agent-platform' },
  'POST /api/stt': { scope: 'microphone_stt', provider: 'google-cloud-speech-to-text' },
  'POST /api/tts': { scope: 'text_tts', provider: 'google-agent-platform' },
});

const SCOPE_PROVIDER: Readonly<Record<AiScope, AiProviderName>> = Object.freeze({
  text_tutor: 'google-agent-platform',
  text_feedback: 'google-agent-platform',
  live_session: 'google-agent-platform',
  translation: 'google-agent-platform',
  memory: 'google-agent-platform',
  microphone_stt: 'google-cloud-speech-to-text',
  text_tts: 'google-agent-platform',
});
const SCOPES = new Set<AiScope>(Object.keys(SCOPE_PROVIDER) as AiScope[]);
const PROVIDERS = new Set<AiProviderName>(['google-agent-platform', 'google-cloud-speech-to-text']);

function isSubject(subject: AiSubject): boolean {
  return !!subject && subject.kind === 'account' && typeof subject.userId === 'string' && subject.userId.length > 0 && subject.userId.length <= 128;
}

function accountExists(subject: AiSubject): boolean {
  if (!isSubject(subject)) return false;
  return !!db().prepare('SELECT 1 FROM users WHERE id = ?').get(subject.userId);
}

function validGrant(grant: AiGrant): boolean {
  return !!grant
    && typeof grant.scope === 'string'
    && SCOPES.has(grant.scope)
    && typeof grant.provider === 'string'
    && PROVIDERS.has(grant.provider)
    && SCOPE_PROVIDER[grant.scope] === grant.provider;
}

function timestamp(now: number): number {
  return Number.isSafeInteger(now) && now >= 0 ? now : Date.now();
}

export function getAiConsent(subject: AiSubject): AiConsent | null {
  if (!accountExists(subject)) return null;
  const rows = db().prepare('SELECT scope, provider, policy_version, granted_at, revoked_at FROM ai_consents WHERE user_id = ?')
    .all(subject.userId) as { scope: string; provider: string; policy_version: string; granted_at: number; revoked_at: number | null }[];
  if (!rows.length) return null;
  const grants: AiGrantRecord[] = rows
    .filter((row) => validGrant({ scope: row.scope as AiScope, provider: row.provider as AiProviderName }))
    .map((row) => ({
      scope: row.scope as AiScope,
      provider: row.provider as AiProviderName,
      policyVersion: row.policy_version,
      grantedAt: row.granted_at,
      revokedAt: row.revoked_at,
    }));
  const latest = [...rows].sort((a, b) => Math.max(b.granted_at, b.revoked_at ?? 0) - Math.max(a.granted_at, a.revoked_at ?? 0))[0];
  const policyVersion = latest.policy_version;
  const active = grants.some((grant) => grant.policyVersion === policyVersion && grant.revokedAt === null);
  const revokedTimes = grants
    .filter((grant) => grant.policyVersion === policyVersion && grant.revokedAt !== null)
    .map((grant) => grant.revokedAt as number);
  return {
    policyVersion,
    grants,
    grantedAt: Math.max(...rows.map((row) => row.granted_at)),
    revokedAt: active || !revokedTimes.length ? null : Math.max(...revokedTimes),
  };
}

export function grantAiConsent(
  subject: AiSubject,
  grantsRaw: readonly AiGrant[],
  policyVersion: string,
  now = Date.now(),
): AiConsent {
  if (!accountExists(subject)) throw new Error('signed account required');
  if (policyVersion !== AI_CONSENT_POLICY_VERSION) throw new Error('policy version mismatch');
  if (!Array.isArray(grantsRaw) || grantsRaw.length < 1 || grantsRaw.length > SCOPES.size || !grantsRaw.every(validGrant))
    throw new Error('invalid consent scope or provider');
  const grants = grantsRaw.map((grant) => ({ scope: grant.scope, provider: grant.provider }));
  const scopes = grants.map((grant) => grant.scope);
  if (new Set(scopes).size !== scopes.length) throw new Error('duplicate consent grant');
  const grantedAt = timestamp(now);
  tx(() => {
    db().prepare(`UPDATE ai_consents SET policy_version = ?, revoked_at = COALESCE(revoked_at, ?)
      WHERE user_id = ?`).run(AI_CONSENT_POLICY_VERSION, grantedAt, subject.userId);
    const upsert = db().prepare(`INSERT INTO ai_consents (user_id, scope, provider, policy_version, granted_at, revoked_at)
      VALUES (?, ?, ?, ?, ?, NULL)
      ON CONFLICT(user_id, scope) DO UPDATE SET provider = excluded.provider,
        policy_version = excluded.policy_version, granted_at = excluded.granted_at, revoked_at = NULL`);
    for (const grant of grants) upsert.run(subject.userId, grant.scope, grant.provider, AI_CONSENT_POLICY_VERSION, grantedAt);
  });
  return getAiConsent(subject)!;
}

export function revokeAiConsent(subject: AiSubject, now = Date.now()): AiConsent | null {
  if (!accountExists(subject)) return null;
  const revokedAt = timestamp(now);
  tx(() => {
    db().prepare(`UPDATE ai_consents SET policy_version = ?, revoked_at = COALESCE(revoked_at, ?)
      WHERE user_id = ? AND revoked_at IS NULL`).run(AI_CONSENT_POLICY_VERSION, revokedAt, subject.userId);
  });
  return getAiConsent(subject);
}

/** Remove only the signed account's saved Vivi memory from its synced progress document. */
export function deleteAiMemory(subject: AiSubject, now = Date.now()): boolean {
  if (!accountExists(subject)) return false;
  const updatedAt = timestamp(now);
  return tx(() => {
    const row = db().prepare('SELECT state FROM progress WHERE user_id = ?').get(subject.userId) as { state: string } | undefined;
    if (!row) return false;
    const state = JSON.parse(row.state) as unknown;
    if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
    const next = { ...(state as Record<string, unknown>), memory: '' };
    db().prepare('UPDATE progress SET state = ?, updated_at = ? WHERE user_id = ?')
      .run(JSON.stringify(next), updatedAt, subject.userId);
    return true;
  });
}

export function hasAiConsent(
  subject: AiSubject,
  scope: AiScope,
  provider: AiProviderName,
  policyVersion = AI_CONSENT_POLICY_VERSION,
): boolean {
  if (!SCOPES.has(scope) || !PROVIDERS.has(provider) || SCOPE_PROVIDER[scope] !== provider) return false;
  const consent = getAiConsent(subject);
  return !!consent
    && consent.policyVersion === policyVersion
    && policyVersion === AI_CONSENT_POLICY_VERSION
    && consent.grants.some((grant) => grant.scope === scope && grant.provider === provider && grant.policyVersion === policyVersion && grant.revokedAt === null);
}
