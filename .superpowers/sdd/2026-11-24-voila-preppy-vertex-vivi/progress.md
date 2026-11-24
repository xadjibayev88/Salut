# SDD ledger — plan: docs/superpowers/plans/2026-11-24-voila-preppy-vertex-vivi.md

## Setup
- Approved plan: `docs/superpowers/plans/2026-11-24-voila-preppy-vertex-vivi.md`; binding spec: `docs/superpowers/specs/2026-11-24-voila-preppy-vertex-vivi-design.md`.
- User authorized starting implementation and involving developer agents; separate feature branch is `feat/voila-preppy-ai-vivi` in isolated worktree `/workspace/.worktrees/voila-preppy-ai-vivi`.
- Plan/spec commit: `c2ac47b` (`docs: approve Voilà Preppy tutor implementation plan`). Task 1 BASE begins at this commit.
- Baseline: `npm test` PASS, 9 files / 99 tests; `npm run typecheck` PASS. `npm ci` reported 5 dependency advisories (2 moderate, 1 high, 2 critical); no audit fix applied.
- Hard approval gates: no Google APIs/billing activation, paid API request, actual Live POC, production resource creation, or deploy without separate explicit approval. Tests use mocks. French A1–C2 remains; no IELTS content. Keep existing Vivi cat silhouette; use natural Uzbek support/humor; no 1:1 claim about GoPrep’s undisclosed models/voices.

## Preflight — shared-file/interface pairs
All work is sequential per SDD; no implementer receives overlapping tasks concurrently. The spec is authoritative.

| Pair | Shared files / interface | Producer → consumer | Finding and ruling |
|---|---|---|---|
| 1–2 | `server/main.ts` | Task 1 creates fail-closed provider/config gate; Task 2 adds consent endpoints and guards. | Compatible. Task 2 must call Task 1 gate, not bypass it. |
| 1–3 | `server/main.ts` | Task 1 config/kill switch → Task 3 shared atomic quota integration. | Compatible. Reserve quota after config and consent checks, before provider call. |
| 1–4 | `server/main.ts` | Task 1 runtime config → Task 4 Google provider wiring. | Compatible. Provider remains disabled until all config/access requirements are satisfied. |
| 1–5 | `server/main.ts` | Task 1 route gate → Task 5 common route middleware. | Compatible. Preserve the Task 1 fail-closed behavior under Task 5 refactor. |
| 1–9 | `server/ai-config.ts`, tests, `server/main.ts` | Task 1 config → Task 9 Live-specific disablement. | Compatible. Task 9 cannot enable Live; it must leave `liveEnabled=false` even if env requests true. |
| 2–3 | `server/db.ts`, `server/main.ts` | Task 2 durable consent schema → Task 3 quota tables/transactions. | Compatible if migrations are additive and share existing DB transaction conventions; consent and quota failures both fail closed. |
| 2–4 | `server/main.ts` | Task 2 consent identity/gate → Task 4 provider adapter. | Compatible. Provider code must not own or bypass consent. |
| 2–5 | `public/privacy.html`, `server/main.ts` | Task 2 consent/disclosure → Task 5 route matrix. | Compatible. Route registry and privacy copy must stay aligned as routes are consolidated. |
| 2–9 | `server/main.ts` | Task 2 revoke/consent endpoint → Task 9 disabled Live route. | Compatible. Disabled Live must not mint a token or start a session regardless of consent. |
| 3–4 | `server/main.ts` | Task 3 atomic reservation → Task 4 provider call boundary. | Compatible. Provider invocation requires a successful reservation; no process-local substitute. |
| 3–5 | `server/main.ts` | Task 3 shared quota → Task 5 common route middleware. | Compatible. Task 5 must reuse quota service rather than duplicate counter logic. |
| 3–9 | `server/main.ts` | Task 3 quota gate → Task 9 Live route disabled state. | Compatible. Disabled Live exits before quota/provider work. |
| 4–5 | `server/main.ts`, `server/tutor.ts`, `server/voice.ts` | Task 4 Google-only provider contract → Task 5 route adapters/gates. | Compatible. Task 5 consumes Task 4 interfaces and removes no-Google bypasses; do not run these tasks in parallel. |
| 4–6 | `server/ai-provider.ts`, `server/voice.ts` | Task 4 `transcribe` provider contract → Task 6 transcript review flow. | Compatible. Task 6 consumes the provider’s transcript result and gates scoring on user confirmation. |
| 4–7 | `server/tutor.ts`, `server/voice.ts` | Task 4 provider boundary → Task 7 tutor/TTS cascade. | Compatible. Task 7 uses only the validated Google provider and no hidden fallback. |
| 4–9 | `server/main.ts` | Task 4 provider transport → Task 9 disabled Live handler. | Compatible. No browser credential or direct Vertex socket is introduced. |
| 5–6 | `server/voice.ts` | Task 5 route consent/quota → Task 6 STT transcript review. | Compatible. STT route gate remains before audio submission; review is an additional downstream gate. |
| 5–7 | `server/tutor.ts`, `server/voice.ts` | Task 5 route middleware → Task 7 tutor response/TTS. | Compatible. Tutor and voice responses stay behind route gates. |
| 5–9 | route files/tests and `server/main.ts` | Task 5 disables legacy Live token path → Task 9 adds Live client disabled behavior. | Compatible. Task 9 extends the existing disabled response; no duplicate token path. |
| 6–7 | `server/voice.ts`, `src/engine/voice/call.ts` | Task 6 confirmed transcript contract → Task 7 tutor/TTS turn. | Compatible. Task 7 accepts only the user-confirmed transcript from Task 6; no scoring/memory before confirmation. |
| 7–8 | `server/vivi-cues.ts` | Task 7 emits validated semantic cue event → Task 8 shares and validates cue schema with client. | Ordering ambiguity: Task 7 needs a usable contract before Task 8. Ruling: Task 7 implements a server validator with exactly the whitelist in Task 8; Task 8 then promotes that same schema to `src/shared/vivi-cue.ts` and makes the server import it, deleting duplicate definitions. Spec whitelist is binding. |
| 8–9 | `src/screens/voice/LiveCall.tsx` | Task 8 maps semantic cues → Task 9 disables Live UI/requests. | Compatible when sequential: keep cue visuals while making the Live entry point clearly unavailable and prevent token requests. |
| 8–10 | `src/shared/vivi-cue.test.ts` | Task 8 schema tests → Task 10 final regression coverage. | Compatible. Task 10 extends/uses existing tests rather than copying assertions or duplicating validators. |

## Preflight — each task’s internal consistency
| Task | Self-check | Ruling |
|---|---|---|
| 1 | Config types/tests, fail-closed behavior, and `server/main.ts` wiring match; repo provides `npm test` and `npm run typecheck`. | Clean; proceed. |
| 2 | Consent persistence, signed identity, UI and seven AI route scopes align with spec; tests include revoke/old version/cross-account. | Clean; proceed after Task 1. |
| 3 | Atomic quota contract/tests and store-failure behavior are aligned; plan explicitly prevents claiming SQLite as a shared hard cap without evidence. | Clean; implement fail-closed if shared durable semantics cannot be proved. |
| 4 | Provider interface, injected transport tests and no-fallback rules align; runtime verification is still required before activation. | Clean; mocks only, provider flag off. |
| 5 | Seven-route matrix matches spec’s seven legacy AI routes; Live is disabled, with provider calls asserted zero on gate failure. | Clean; preserve middleware order and privacy consistency. |
| 6 | STT result/review UI and scoring gate align; no numeric confidence threshold is invented. | Clean; test fixtures only, no paid audio. |
| 7 | Tutor behavior, cue event and sequential STT→Gemini→TTS cascade match spec. | Clean with the Task 7–8 cue-schema ruling above. |
| 8 | Whitelist values and mascot mapping match spec; reduced motion and original cat silhouette are in scope. | Clean; no GoPrep assets/voice/model claims. |
| 9 | Config/route/client all retain disabled Live state; POC/API/billing are explicitly excluded. | Clean; never perform POC or enablement. |
| 10 | Final tests and rollout gates cover prior requirements; commit staging excludes unrelated/secrets files. | Clean; no deploy or live provider use. |

## Progress
- Tasks 1 and 2 are implemented. Task 2's independent-review fix round is complete in commit `470b5267dfc1c69b55fd0c914a78a142dc1fb3d1`; no unrelated changes are pending.


## Task 1 review and ruling
- Review package: `review-c2ac47b..cb29ae3.diff`; Task reviewer reported model configuration mismatch (P1) and ADC readiness assertion (P2).
- Ruling on P1: The reviewer was given an incorrect global constraint copied from the separate IELTS plan (`GEMINI_MODEL=gemini-3.8-flash`), which does not apply to this Voilà task. The binding Voilà design identifies `gemini-3.5-flash-lite` as the Agent Platform text-model candidate, subject to project verification (`docs/superpowers/specs/2026-11-24-voila-preppy-vertex-vivi-design.md`, table row 38); the implementation accepts this same candidate via `VIVI_AI_MODEL`. No code change for P1. Cost if this ruling is wrong: a model candidate might not be available in a particular project, but the project verification marker is required and `GOOGLE_PROVIDER_TRANSPORT_READY` keeps all AI routes disabled.
- P2 is a real clarity/contract gap: `credentialsPresent` is derived from `GOOGLE_CLOUD_ADC_CONFIGURED=true`, which is an operator attestation, not an actual ADC credential check. Address by naming/documenting it as an attestation or by adding a safe readiness check; keep the provider gate closed unless actual server transport readiness is proven. No live auth request or Google API call.
- Task 1 fix round 1/5 begins after P2 resolution; re-review required against only the fix diff.


Task 1: fix round 1/5 (1 addressed, 0 open — ADC readiness is explicitly operator attestation; commits `cb29ae3`..`848794f`).
Task 1: minor (deferred): the ADC attestation refactor removed a test asserting that a supplied credential path is absent from the returned config; implementation still does not copy environment values into config. Final reviewer to triage this coverage gap.
Task 1: complete (commits `c2ac47b`..`848794f`, review clean).

## Task 2 independent review — fix round 1
- Addressed the review findings in `task-2-review.md`: tutor request memory is removed server-side unless the signed account has active `memory` consent; the same guard is applied to the Live prompt parser for future enablement.
- Text and voice flows now show the exact turns proposed for a memory update and submit them only after the user explicitly chooses “Tasdiqlash va xotirani yangilash”. `updateMemory` refuses to call the endpoint unless passed explicit confirmation.
- Extracted the AI route registry gate and added regression coverage: `/api/live/token` is excluded when `liveEnabled=false`, including the `providerEnabled=true` case.
- TDD evidence: the first focused run reproduced missing memory sanitization, an unconfirmed memory fetch, and the absent Live gate; after fixes, focused tests pass (3 files / 16 tests).
- Final verification: `npm test` PASS (13 files / 130 tests); `npm run build` PASS; `git diff --check` PASS. Local-only smoke test returned HTTP 404 for `POST /api/live/token` with the provider disabled; no Google/provider request was made.
- Commit: `470b5267dfc1c69b55fd0c914a78a142dc1fb3d1` (`fix(ai): require consent for memory and gate Live route`). Provider, billing, and deployment remain disabled.

## Task 3 independent review and fix rounds
- The independent reviewer confirmed that quota reservation/settlement is not yet on provider-handler paths. This is deliberate under the Task 3 brief: the route registry readiness gate remains `false` until Task 5 wires reservation-before-call and settlement/abort into every handler/fallback. Do not flip it earlier.
- Added idempotent `abortAiUsage` for reservations known not to have reached an upstream provider; it releases only that reservation's held counters. There is intentionally no automatic expiry for ambiguous/in-flight reservations. A process crash may leave a hold that requires operator reconciliation; clearing it automatically could allow a concurrent billable call to exceed the cap.
- Overrun settlement now checks that the kill-switch row update changed exactly one row inside the same SQLite transaction; a missing row causes rollback and a fail-closed `store_error`. Reservation state transitions also verify their update count.
- Added the required `task-3-report.md`. Production shared durable SQLite remains unproven, and provider/Live/billing/deployment gates remain closed.
- Second independent review caught an incomplete legacy schema migration and test coverage gaps. Initialization now adds missing `overrun`/`aborted` flags with safe defaults and validates every required reservation column; an old-schema DB regression test verifies migration and normal reservation after upgrade.
- Route-gate tests now enumerate all seven provider route keys. Tests also cover abort after settlement and a two-independent-connection abort/settle race; exactly one transition succeeds and counters are not released twice.
- Focused quota/config/route-gate tests: 3 files / 43 tests PASS. Final `npm test`: 14 files / 156 tests PASS, including concurrent last-unit reservation, abort/settle race, legacy migration, and persistence-after-restart cases.
- Final `npm run typecheck`, `npm run build`, and `git diff --check` PASS. Build retains Vite warnings for non-module `ads-config.js` / `site-config.js` tags and the existing >500 kB chunk.
- Final independent re-review found no actionable findings and cleared the scoped Task 3 changes for commit.
- No Google/provider request, billing change, paid request, Live POC, or deployment was performed.

## Task 4 independent-review fix round — pending re-review
- Added server-only `AiProvider` interfaces, Google-only registry, and `createGoogleCloudProvider(config, { auth, fetchImpl })`; auth and fetch are injected, config is verified before use, errors are sanitized, and no vendor fallback exists.
- Fixed both P2 findings from `task-4-review.md`: aborts during `response.json()`/body consumption are surfaced as `request_aborted`; TTS now validates RIFF size, `WAVE` form, chunk bounds/padding, `fmt ` and non-empty `data` chunks, and PCM alignment. Regression tests cover body-read abort, a valid PCM WAV fixture, and malformed/truncated WAV cases.
- Fake-transport result: `npm test -- server/ai-provider.test.ts server/google-cloud-provider.test.ts` PASS (2 files / 20 tests); cancellation before auth, during auth, and during body reading is covered. `npm run typecheck` PASS.
- The adapter is not wired into `main.ts`; browser source has no imports. `GOOGLE_PROVIDER_TRANSPORT_READY` and `AI_QUOTA_RESERVATION_MIDDLEWARE_READY` remain `false`; all AI routes remain disabled pending Task 5 quota/handler wiring.
- Retry-plan variance explicitly reconciled in the Task 4 brief and report: **no retry until a documented provider idempotency contract is available.** The checked REST contracts do not establish idempotency; no automatic retry is added because it could duplicate a billable POST. `streamTutor` currently uses unary `generateContent` and yields one full text chunk because the stream REST reference does not establish the wire framing needed for a parser.
- STT/TTS runtime configuration (including project-verified recognizer/model/location/voice) is not established; methods fail closed until explicitly supplied. No ADC lookup, Google request, API enablement, billing change, paid request, Live POC, or deployment occurred.
- Updated report: `.superpowers/sdd/2026-11-24-voila-preppy-vertex-vivi/task-4-report.md`. No commit; await independent re-review.


## Task 5 implementation — independent review pending
- Created the Task 5 brief before application edits. Added `server/ai-routes.ts` factories for all seven route scopes and the consent HTTP routes. For the six non-Live AI endpoints, the order is signed identity → exact current consent/version/provider → same-origin/allow-list and Fetch Metadata protection → provider config/kill switch → input validation → atomic quota reservation → minimized payload → one provider attempt → settle; known pre-attempt failures abort the reservation. Storage/config/provider failures return sanitized responses. The provider payload is snapshotted with `structuredClone` so mutations to the operation's exposed working copy cannot widen data sent upstream.
- `/api/live/token` remains a hard-coded disabled response that does not read identity, consent, provider configuration, quota, or invoke a provider. Production handler registrations for legacy Gemini Developer API, model rotation/hedging, Live token minting, Azure, ElevenLabs, and other prior AI paths were removed. Client free-form telemetry is consumed but no longer logged; the direct Live WebSocket host was removed from CSP.
- Added route tests for all seven scopes, zero provider calls on gate and quota failures, quota reservation/settle/abort behavior, sanitized errors, no retry/second attempt, minimized-payload isolation, and Live disabled behavior. Added consent HTTP tests for signed-in/out identity, current/stale policy, invalid grants, account isolation, storage failures, and Origin/Fetch-Metadata protections.
- Updated runtime voice capability responses and `public/privacy.html`: server AI/STT remain off, device/browser TTS is disclosed, and Live remains off.
- Verification after the final code change: `npm test -- server/ai-routes.test.ts server/tutor.test.ts server/voice.test.ts` PASS (3 files / 93 tests); `npm run typecheck` PASS; `npm run build` PASS; `git diff --check` PASS. Build retains existing warnings for non-module `ads-config.js`/`site-config.js` and the >500 kB bundle chunk.
- Readiness remains closed: `GOOGLE_PROVIDER_TRANSPORT_READY = false`, `AI_QUOTA_RESERVATION_MIDDLEWARE_READY = false`; production shared durable SQLite is unverified and its operator attestation defaults false. ADC/project/model/STT/TTS runtime verification is not established. No Google auth/API call, billing change, paid request, Live POC, or deployment was performed.
- Independent review requested against the final uncommitted diff; result pending. No commit or staging performed. Report: `.superpowers/sdd/2026-11-24-voila-preppy-vertex-vivi/task-5-report.md`.


## Task 5 independent-review fix round — re-review pending
- First independent review found one P2: the disabled `/api/live/token` stub was still retained in the production route table. The route itself was safe but its registration contradicted the plan and left a future wiring mistake reachable.
- Fix: `enabledAiRoutes` now unconditionally omits Live, while `server/main.ts` dispatches the Live request to the hard-disabled handler outside the production route table. Regression tests assert that Live remains absent even when other provider/quota gates are true and that the explicit disabled dispatch remains configured.
- Fix-round verification: `npm test -- server/ai-routes.test.ts server/tutor.test.ts server/voice.test.ts` PASS (3 files / 94 tests); `npm run typecheck` PASS; `npm run build` PASS; `git diff --check` PASS. Only the previously noted non-module script and >500 kB chunk warnings remain.
- Updated `task-5-report.md`. The fix-round diff has been submitted for independent re-review; no files are staged or committed.


## Task 5 fix round 1 independent review — clean at that review point
- The independent fix-round reviewer confirmed the P2 is resolved: `enabledAiRoutes()` unconditionally omits Live, and production dispatch calls only the hard-disabled response outside the route table. The disabled Live handler does not read identity, consent, provider/config readiness, quota, or request body and cannot call a provider.
- Reviewer found no remaining actionable security or correctness findings in the Task 5 diff. Production shared durable SQLite, provider/ADC, and STT/TTS readiness remain unverified and must not be inferred from unit checks.
- Final state: focused tests 3 files / 94 tests PASS; typecheck, build, and `git diff --check` PASS. No staging or commit.


## Task 5 independent-review fix round 2 — fresh review pending
- Addressed all actionable items from the subsequent review in `task-5-review.md`: added production route-specific input parsing/minimization for all six non-Live endpoints; wired the real `sanitizeTutorBodyForMemoryConsent` helper and route-tested absent, revoked, and active memory grants; removed TTS POST retries; added bounded route deadlines, provider cancellation, and safe quota lifecycle behavior; strengthened AI POST Origin/Fetch-Metadata checks; aligned health with effective route readiness; and narrowed consent test claims while adding explicit stale/revoked/wrong-provider/cross-account cases.
- Sanitizer failures now fail closed as unavailable; thrown route parsing failures return a client error before quota reservation. Same-host scheme mismatch, missing Origin, cross-site metadata, and missing trusted origin are explicitly covered. Existing non-AI route origin behavior remains unchanged.
- Focused tests PASS (9 files / 203 tests); full `npm test` PASS (16 files / 256 tests); `npm run typecheck` PASS; `npm run build` PASS; `git diff --check` PASS. Existing Vite warnings remain for the non-module `ads-config.js`/`site-config.js` scripts and the >500 kB chunk.
- `GOOGLE_PROVIDER_TRANSPORT_READY`, `AI_QUOTA_RESERVATION_MIDDLEWARE_READY`, and `AI_ROUTE_OPERATIONS_READY` remain `false`. Shared durable quota storage and Google runtime readiness remain unverified. No Google auth/API calls, billing changes, paid calls, Live POC, or deployment occurred.
- Updated report: `.superpowers/sdd/2026-11-24-voila-preppy-vertex-vivi/task-5-report.md`. A fresh independent review of this fix-round diff is requested; no staging or commit until the review is received and handled.


## Task 5 provider identity fix — verification complete, independent review pending
- A fresh independent review of the second fix round found a remaining P2 identity mismatch: `/api/stt` consent names `google-cloud-speech-to-text`, but the provider registry accepted only `google-agent-platform`, while the combined Google adapter exposed only the latter identity.
- Reconciled the contract explicitly: the registry now recognizes both distinct consent/disclosure identities; each adapter declares the service identities it handles; the single Google adapter declares both Agent Platform and Cloud Speech. The STT route identity therefore resolves to the Google adapter and its `transcribe` method uses the Cloud Speech API. Agent Platform and Cloud Speech consent disclosures remain separate, with no fallback.
- TDD evidence: new registry and adapter integration tests failed on the prior contract (STT identity rejected; adapter did not advertise Cloud Speech), then passed after the explicit service-identity mapping. Focused result: 2 files / 22 tests PASS.
- Final verification after all fixes: full `npm test` PASS (16 files / 258 tests); `npm run typecheck` PASS; `npm run build` PASS; `git diff --check` PASS. Build retains only the existing non-module script and >500 kB chunk warnings.
- `GOOGLE_PROVIDER_TRANSPORT_READY`, `AI_QUOTA_RESERVATION_MIDDLEWARE_READY`, and `AI_ROUTE_OPERATIONS_READY` remain `false`; Live remains disabled. No production adapter wiring, Google auth/API calls, billing changes, paid calls, Live POC, or deployment.
- Fresh independent review of the full uncommitted diff returned clear with no actionable findings. The reviewer independently verified the STT identity mapping, fail-closed duplicate/invalid service registration, six route minimizers, cancellation/quota behavior, strict origin checks, effective readiness, consent-test scope, disabled Live path, and unchanged false gates; its test/typecheck/build/diff-check results also passed.
- Task 5 report updated. No files were staged or committed; review does not authorize enabling provider operations or deployment.
