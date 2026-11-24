# Task 6 report — Cloud STT transcript review and scoring protection

## Result

Task 6 is implemented on `feat/voila-preppy-ai-vivi` in `/workspace/.worktrees/voila-preppy-ai-vivi`. Cloud STT returns a validated `SttResult` carrying the transcript, detected language, optional confidence, alternatives and review reasons. Each result first enters editable review. Only explicit confirmation of a non-empty final draft creates a user turn and invokes the tutor/post-turn callback; re-record discards the draft, and cancel closes the call without submission. Unconfirmed text is not sent to tutor, scoring, correction or memory.

The new voice-call path is Cloud STT only; it does not select or fall back to `SpeechRecognition`, `WebSpeechStt` or `HybridStt`. The separate Tutor dictation path remains compatible. The dormant Live client has a fail-closed language/confirmation guard before token fetch, microphone access or WebSocket creation. Live and provider routes remain disabled.

## Implementation and tests

`src/engine/voice/stt-result.ts` defines the typed result and deterministic metadata-only review policy. No numeric confidence threshold is introduced. The server preserves a provider confidence value only when a single unambiguous scalar is available; it does not fabricate an aggregate from segment values. Thirty-eight labeled synthetic metadata fixtures cover 12 Uzbek, 12 French, 10 mixed Uzbek–French and 4 unknown-language cases, including confidence metadata, conflicting alternatives, language mismatch, code-switch, target-sensitive variation, noise flags and empty transcripts. Client/server tests use mocks only; no recorded audio was sent to a provider.

The VoiceCall controller/UI provides editable transcript review and explicit confirm, re-record and cancel actions. Only confirmed non-empty text can create a user turn or invoke the tutor/post-turn callback. Cloud STT metadata is validated and sanitized end-to-end; legacy text-only results are rejected in the new client path.

The `LiveSession.start()` guard permits entry only for an explicitly user-confirmed, non-empty `fr-FR` result whose confirmed text matches the STT text and whose review-reason list is empty. Every known non-empty reason blocks entry, including missing confidence, conflicting alternatives, possible noise and target-phrase mismatch. Malformed reason data and unknown runtime reason strings also fail closed. Missing, unconfirmed, empty, Uzbek, unknown, mixed/code-switch, and mismatched-language results stop before `/api/live/token`, microphone permission, and the sole browser WebSocket constructor. Mocked regressions cover these unsafe cases, a changed confirmation, malformed/unknown reasons, and a clean confirmed French result that passes the guard. The clean positive test intentionally stops at a mocked microphone rejection; it does not create a real WebSocket. The current VoiceHub does not supply a reviewed transcript, and server configuration/routes still disable Live; this adds no STT preflight and does not enable or alter provider/Live route gates.

Changed implementation/test files: `server/ai-route-operations.ts`, `server/voice.test.ts`, `src/engine/voice/call.ts`, `src/engine/voice/call.test.ts`, `src/engine/voice/live.ts`, `src/engine/voice/live.test.ts`, `src/engine/voice/stt.ts`, `src/engine/voice/stt-result.ts`, `src/engine/voice/stt-review.test.ts`, `src/engine/voice/stt-client.test.ts`, `src/screens/Tutor.tsx`, `src/screens/voice/VoiceCall.tsx`, `src/screens/voice/VoiceHub.tsx`, and `src/styles.css`.

## Verification

- Focused voice/STT/Live suite: `npm test -- src/engine/voice/live.test.ts src/engine/voice/call.test.ts src/engine/voice/stt-review.test.ts src/engine/voice/stt-client.test.ts server/voice.test.ts` — **PASS**, 5 files / 84 tests.
- Full `npm test` — **PASS**, 18 files / 323 tests.
- `npm run typecheck` — **PASS**.
- `npm run build` — **PASS**. Existing Vite warnings remain for classic `ads-config.js` and `site-config.js` script tags and the >500 kB minified client chunk.
- `git diff --check` — **PASS**.
- Confirmed `server/ai-config.ts`, `server/ai-routes.ts`, and `server/main.ts` were not changed; `GOOGLE_PROVIDER_TRANSPORT_READY` and `liveEnabled` remain false, `/api/voice/config` returns `live: false`, the Live token route remains disabled, and `src/engine/voice/live.ts` is the sole browser WebSocket constructor.

TDD evidence: the transcript-flow baseline reproduced 45 failing assertions before implementation. The original Live-entry regressions reproduced nine unsafe cases reaching token fetch before the guard. During independent re-review, five additional cases—French transcripts carrying confidence-missing, alternatives-conflict, possible-noise, target-mismatch or an unknown reason—reproduced token fetch before the refinement. After adding the stricter guard and tests, all 19 `live.test.ts` cases pass, including malformed reason data.

## Limits and approval boundary

This is metadata/mock-only validation. No real audio, Google authentication/API call, provider request, paid STT/TTS/text, billing change, Live proof-of-concept or deployment was performed. Production provider readiness, shared durable quota verification and Live remain disabled. Confidence values are carried as metadata only; there is no calibrated threshold and no claim that automatic code-switch detection is reliable. No staging or commit occurred before the clean review. The user subsequently authorized a local commit limited to the Task 6 source/test files, brief, report and progress ledger; no other files or external actions are authorized.

## Independent review outcome

The first independent review found that the dormant Live client needed a language/confirmation gate; that guard was added before token fetch, microphone access and WebSocket creation. A subsequent review found that a confirmed French transcript with other review reasons could still pass. The guard now requires an empty reason list and fails closed on malformed or unknown runtime reason values. The final independent re-review found **no actionable findings**: it verified all eight `SttReviewReason` values, the guard’s placement before token/microphone/WebSocket operations, the negative assertion matrix, the clean French positive case, caller behavior, and unchanged disabled route/config gates. It independently ran the focused suite (5 files / 84 tests) and `npm run typecheck`, both passing. This review does not authorize enabling Live/providers. The separately approved local commit remains limited to the exact Task 6 scope.
