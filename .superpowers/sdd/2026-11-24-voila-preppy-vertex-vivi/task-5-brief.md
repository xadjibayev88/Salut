# Task 5 implementation brief — seven AI route consent/quota gate and privacy consistency

## Goal and approved boundaries

Implement only Task 5 of `docs/superpowers/plans/2026-11-24-voila-preppy-vertex-vivi.md` in `/workspace/.worktrees/voila-preppy-ai-vivi` on `feat/voila-preppy-ai-vivi`. Preserve the binding design and the independently accepted Task 2–4 contracts. All seven AI routes must share a server-side gate that checks signed account identity, current policy/scope/provider consent, configuration and kill switch, then an atomic quota reservation before any provider attempt. Every gate failure must result in exactly zero provider calls. Settle after every attempted provider operation; abort a reservation only when it is known no upstream attempt occurred.

No Google auth lookup or API request, API enablement, billing change, paid request, Live POC, or deployment is permitted. Do not expose a browser credential or enable a provider path while any readiness prerequisite is false. Keep `GOOGLE_PROVIDER_TRANSPORT_READY` and `AI_QUOTA_RESERVATION_MIDDLEWARE_READY` false unless the complete approved runtime contract is actually complete; production shared durable SQLite remains unproven and its operator attestation defaults false. Keep Live disabled regardless of consent/provider state. Do not commit; implementation must receive an independent review first.

Preserve Task 4’s explicit variance: **no POST retries until a documented provider idempotency contract exists.** Do not add OpenAI-compatible, Gemini Developer API, Azure, ElevenLabs, browser STT, or any other fallback to the Google-only route registry. Remove or make unreachable the legacy provider/fallback handlers so a later readiness change cannot bypass the new middleware. Keep Voilà! as French A1–C2; do not add IELTS or claim 1:1 replication of GoPrep.

## Repository findings and constraints

- `server/ai-consent.ts` supplies the seven route scope/provider requirements, active policy-version checks, signed-account subject type, and memory sanitization. STT consent is specifically `google-cloud-speech-to-text`; other route scopes use `google-agent-platform`.
- `server/ai-quota.ts` supplies `reserveAiUsage`, `settleAiUsage`, and `abortAiUsage` with atomic SQLite transactions, kill-switch checks, and fail-closed shared-storage attestation. Usage requires one request and nonnegative token/audio/character dimensions. Do not claim production hard-limit semantics without the shared durable store proof.
- `server/ai-provider.ts` and `server/google-cloud-provider.ts` supply an injected Google-only provider boundary. STT/TTS service-specific production configuration is not verified; do not invent model, recognizer, voice, location, auth, or transport readiness.
- `server/main.ts` currently repeats consent/quota checks outside its handler table and has legacy AI routes using Gemini Developer API, hedging/model rotation, and Azure/ElevenLabs fallbacks. `/api/live/token` currently contains a legacy Gemini ephemeral-token path. Current `enabledAiRoutes` removes AI routes while the provider/quota gates are false.
- Task 2’s independent review specifically flagged lack of route-level tests for consent HTTP endpoints and Origin/Fetch-Metadata protections. Mutation helper currently requires explicit allowed Origin and rejects `Sec-Fetch-Site: cross-site`; preserve and test this.
- `public/privacy.html` already says the named Google routes are off and discloses per-scope data/provider use, region/retention uncertainty, and no hidden fallback. Keep it aligned with runtime and avoid unsupported provider-retention promises.

## Design and implementation sequence

1. **Test-first route factory and contract.** Extend `server/ai-routes.ts` into a testable `createAiRoutes(deps)`/shared middleware boundary. Dependencies must be injectable (identity, consent/version/provider check, runtime config/kill switch, quota store, provider/operation handlers, request ID, response helpers as needed); there must be no process-global provider or secret lookup in the middleware. Keep the route scope matrix as the single source of truth. The production server may supply provider handlers only behind the full readiness gate; route integration tests use fakes.
2. **Gate order and usage lifecycle.** Enforce: signed identity → current consent for that exact route scope/provider → provider/config readiness and global kill switch → locally parsed/validated input and an atomic usage reservation → minimized provider input → provider call. Parsing/preflight must not expose the raw payload upstream or log it. Reserve before any upstream call. Track whether an upstream attempt began: settle in `finally` after an attempt, and call `abortAiUsage` only before an attempt. Surface quota-store failures as safe fail-closed responses. Do not retry, hedge, rotate, or fan out a POST. Sanitize provider errors and all logs; never include upstream bodies, prompts, transcript, memory, audio, tokens, or credentials.
3. **All seven routes and Live.** Cover `/api/tutor`, `/api/tutor/feedback`, `/api/live/token`, `/api/translate`, `/api/tutor/memory`, `/api/stt`, and `/api/tts`. Memory/translation receive no exemption. `/api/live/token` must return a disabled response with zero provider calls regardless of identity, consent, provider flag, or quota state, and must never mint a Gemini Developer API token. Keep it out of the production route table.
4. **Consent HTTP and browser-write protection.** Add route-level handler tests for `GET/PUT/DELETE /api/ai/consent` where feasible, including signed-in vs signed-out identity, policy version mismatch, malformed/invalid scopes, and cross-account isolation. For `PUT` and `DELETE`, require an explicit same/allow-listed Origin and reject `Sec-Fetch-Site: cross-site`; test absent Origin, disallowed Origin, cross-site metadata, and allowed same-origin behavior. GET stays read-only.
5. **Provider boundary and disclosure.** Use only the injected Task 4 Google provider contract in reachable AI handlers; strip legacy provider/fallback call sites from these routes. Minimize fields per the approved route matrix. Update `public/privacy.html` and runtime capability/provider disclosures so they agree: routes remain off until verified; named provider/data-purpose statements remain conditional, no unverified region/retention claim, and no non-Google server fallback.
6. **Readiness and ledger.** Keep both transport/quota readiness constants false unless the full route/runtime contract is verifiably complete. Since shared durable storage, provider configuration/ADC, and STT/TTS verification are still absent, production AI routes must remain unavailable. Record those open gates explicitly in the report and SDD ledger.

## TDD and verification

First add failing route-middleware and consent-endpoint regression tests, then run:

```sh
npm test -- server/ai-routes.test.ts
```

Implement the smallest fix, then run the focused route/tutor/voice tests:

```sh
npm test -- server/ai-routes.test.ts server/tutor.test.ts server/voice.test.ts
npm run typecheck
npm run build
```

Tests must cover each route’s consent present/absent/revoked/old-version/wrong-provider/cross-account cases; unauthenticated identity; config disabled; kill switch; quota exhausted, store-unverified, and store error; and assert provider call count is exactly zero for every denial. Cover reservation-before-call, settlement after success/failure, abort only before attempt, response/log sanitization, all seven routes’ current scopes, Live disabled under all states, no retries/fallbacks, and consent mutation Origin/Fetch-Metadata protections. Do not make real provider requests.

Update `.superpowers/sdd/2026-11-24-voila-preppy-vertex-vivi/progress.md` and create `task-5-report.md`. Run `git diff --check` and inspect `git status --short`; do not stage or commit before the independent review.

## Expected files

Expected: `server/ai-routes.ts`, `server/ai-routes.test.ts`, `server/main.ts`, and targeted changes in `server/tutor.ts`, `server/voice.ts`, `public/privacy.html`; update this brief, `progress.md`, and add `task-5-report.md`.
