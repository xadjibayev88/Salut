# Task 3 — Atomic AI usage quota and kill switch

## Outcome

Implemented SQLite-backed daily quotas for signed subjects and the global service across requests, tokens, STT audio seconds, TTS characters, and TTS audio seconds. Reservations use `BEGIN IMMEDIATE`, request IDs are idempotent, actual usage is settled once, and overrun activation of the persisted kill switch is verified inside the same transaction. If the kill-switch row is missing or cannot be updated, settlement rolls back.

`abortAiUsage` idempotently releases only its own reservation when no upstream provider attempt was made. Schema initialization migrates missing `overrun` and `aborted` flags with safe defaults, validates all reservation columns the service depends on, and fails closed if other required columns are absent. Subject caps remain separate from global caps; example quota values remain unset.

## Gates that remain closed

- Provider handlers do not yet reserve or settle usage. This is intentionally deferred to Task 5. The route registry's `quotaReservationReady` flag is hard-coded false, and tests explicitly assert that all seven provider route keys remain unavailable until every handler and fallback reserves before calling upstream and settles or safely aborts afterward.
- Production shared durable SQLite storage and cross-replica semantics have not been proven. `VIVI_AI_QUOTA_STORE_SHARED_DURABLE_VERIFIED` defaults to false, and a non-memory file plus explicit operator attestation are required. This implementation does not claim an active production hard cap.
- Reservations with an ambiguous outcome are not automatically expired. If a process crashes after reserving, its hold remains until operator reconciliation; automatically releasing a possibly in-flight billable call could admit over-cap usage. Task 5 must settle in a `finally` path and abort only before any upstream attempt.
- Google/provider requests, billing changes, paid calls, Live POC, and deployment were not performed. Existing consent gates and Live-disabled behavior remain intact.

## Review fixes and verification

The independent reviews' actionable findings were addressed: legacy schema migration and defaults are tested; all seven routes are checked; settlement-after-abort and abort-after-settlement are covered; and two independent SQLite connections race abort against settlement, with exactly one transition and no double counter release.

The final independent re-review found no actionable issues and cleared the change for commit.

- Focused quota/config/route-gate tests: 43 passed across 3 files.
- Full suite: 156 tests passed across 14 files, including concurrent last-unit reservation, abort/settle race, legacy migration, and restart persistence tests.
- `npm run typecheck`: passed.
- `npm run build`: passed. Existing Vite warnings remain for the two non-module scripts in `index.html` and the 500 kB bundle-size threshold.
- `git diff --check`: passed.
