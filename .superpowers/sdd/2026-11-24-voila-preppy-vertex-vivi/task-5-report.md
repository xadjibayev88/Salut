# Task 5 report — AI route consent, quota, and privacy gates

## Result

The original Task 5 implementation and the requested independent-review fixes are present in `/workspace/.worktrees/voila-preppy-ai-vivi` on `feat/voila-preppy-ai-vivi`. All six non-Live AI endpoints now have route-specific parsing, allowlisted payload construction, usage estimation, and response sanitization. Tutor requests strip saved memory unless the signed account has a separate, current `memory` consent. Live remains unconditionally disabled and is not registered as an enabled production route.

Production AI routes remain unavailable. `GOOGLE_PROVIDER_TRANSPORT_READY`, `AI_QUOTA_RESERVATION_MIDDLEWARE_READY`, and `AI_ROUTE_OPERATIONS_READY` are all `false`. This work does not approve provider activation, billing, Live, or deployment.

## Review findings addressed

- **Route-specific data minimization:** `server/ai-route-operations.ts` parses and allowlists tutor, feedback, translation, memory, STT, and TTS inputs. The provider sees only the constructed prompt, audio bytes plus explicit language, or cleaned TTS text; provider results for feedback, memory, and STT are sanitized. Route tests assert the minimized payloads and exclusion of unrelated fields.
- **Tutor memory consent:** production wiring applies `sanitizeTutorBodyForMemoryConsent` before tutor parsing. Route-level tests exercise the real helper against absent, revoked, and active separate memory grants; memory is omitted in the first two cases and included only in the active case.
- **No TTS POST retries:** `src/engine/voice/tts.ts` makes one `POST /api/tts` attempt. Tests assert a single request for retryable 503, quota 429, and ambiguous network failure responses.
- **Bounded cancellation and quota lifecycle:** AI route attempts have bounded deadlines and bounded cancellation grace. Provider calls receive an abort signal, and Google auth-token acquisition is abort-aware. Reservations abort only before any provider attempt; completed attempts settle. If an in-flight provider attempt remains ambiguous beyond the grace period, the reservation is retained rather than auto-released. Deadline and lifecycle cases are covered by route tests.
- **Strict AI POST Origin/Fetch-Metadata checks:** AI POSTs and consent mutations share validation that requires a valid Origin, rejects cross-site/unsupported Fetch Metadata, and compares `same-origin` against the trusted public/proxy scheme and authority. It fails closed if that trusted origin cannot be derived. Tests cover missing Origin, cross-site metadata, same-host/wrong-scheme Origin, and unavailable trusted origin. Unrelated legacy route-origin behavior was not changed.
- **Effective readiness reporting:** `/api/health` and `/api/voice/config` report the effective AI readiness, including provider, quota middleware, shared durable storage, operation readiness, and kill-switch state. Health exposes the model only when the effective route is ready.
- **Consent coverage accuracy:** route consent titles now match what they assert. Explicit route-level cases cover stale policy, revoked consent, wrong provider, and a different account; memory filtering has separate absent/revoked/active cases.
- **STT provider identity resolution:** consent/disclosure identities remain separate (`google-agent-platform` for Agent Platform and `google-cloud-speech-to-text` for Cloud Speech). The Google adapter explicitly advertises both service identities; the provider registry resolves the STT route’s Cloud Speech identity to that same adapter, whose STT operation calls the Cloud Speech endpoint. Registry and adapter-level tests verify this mapping without merging the two consent disclosures or introducing fallback.

The old browser Live WebSocket flow remains a later Task 9 item. No token minting or Live operation was restored.

## Verification

- Provider-identity regression tests: **PASS**, 2 files / 22 tests. Before the identity fix, the new cases reproduced the unsupported STT identity and missing adapter declaration.
- Full `npm test` after all fixes: **PASS**, 16 files / 258 tests.
- `npm run typecheck`: **PASS**.
- `npm run build`: **PASS**. Existing Vite warnings remain for classic `ads-config.js` and `site-config.js` script tags and the >500 kB client chunk.
- `git diff --check`: **PASS**.

Tests use mocks/fakes; no real Google authentication or provider request was made.

## Readiness and approval boundaries

`GOOGLE_PROVIDER_TRANSPORT_READY = false`, `AI_QUOTA_RESERVATION_MIDDLEWARE_READY = false`, and `AI_ROUTE_OPERATIONS_READY = false`. Production shared durable storage is not verified; its operator attestation remains unproven. Provider/ADC and service runtime configuration also remain unverified. No Google authentication/API request, API enablement, billing change, paid request, Live POC, or deployment was performed.

## Review and version control

The initial independent review is recorded at `.superpowers/sdd/2026-11-24-voila-preppy-vertex-vivi/task-5-review.md`. Its findings and the subsequent provider-identity finding have been addressed in code and regression tests. A fresh independent re-review of the full uncommitted diff returned **clear with no actionable findings**. This is not approval to enable or deploy AI provider operations: readiness and Live gates remain false. No files have been staged or committed.
