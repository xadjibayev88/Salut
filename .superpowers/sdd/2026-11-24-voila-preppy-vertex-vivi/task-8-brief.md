# Task 8 implementation brief — shared Vivi cue schema and recognizable cat animation

## Goal and approved boundaries

Implement only Task 8 of `docs/superpowers/plans/2026-11-24-voila-preppy-vertex-vivi.md` in `/workspace/.worktrees/voila-preppy-ai-vivi` on `feat/voila-preppy-ai-vivi`. Follow the binding design and the SDD ruling in `progress.md`: promote Task 7's temporary server/client cue mirrors to one versioned schema at `src/shared/vivi-cue.ts`, and make both server and client consume that implementation.

This is code, tests, and local documentation only. Do not call Google/ADC or any provider, send real text/audio, enable a provider/readiness gate, alter billing, perform a Live POC, deploy, stage, or commit. Keep all provider, quota/route-operation, and Live gates unchanged and false/disabled. Keep Voilà! focused on French A1–C2 with no IELTS content and make no 1:1 GoPrep replication claim. Preserve the original Voilà! cat silhouette; do not copy GoPrep assets or voices.

## Binding cue contract

- Add `src/shared/vivi-cue.ts` as the single owner of `VIVI_CUE_SCHEMA_VERSION`, the exact enums, `ViviCue` types, neutral cue, and `validateViviCue(value): ViviCue`.
- Whitelist only state `idle|listening|thinking|speaking`; face `neutral|happy|amused|curious|confused|surprised|supportive|proud`; action `blink|head_tilt|ear_perk|tail_wag|giggle|hop|wave`; and optional single ornament `sparkle|thought_dots|heart`.
- Unknown/malformed values, unrecognized commands, and any prohibited/morph/sound command (including `angry`, `slap`, `punch`, `spit`, `flip`, shape changes, arbitrary code, or sound-effect requests) resolve to the fully neutral cue. Do not forward arbitrary fields or model strings to animation code.
- Make `server/vivi-cues.ts` a compatibility re-export only (no duplicated schema or validator). Remove the client mirror and update client imports to the shared module. Tests must establish enum coverage, fail-closed behavior, versioning, and that server/client paths use the shared implementation.

## Mascot behavior and safety

- Keep the existing cat body, ears, face, and tail recognizable in every state; remove body shape morphing and unsafe combat, rude, bodily-function, and sound-effect animation paths from the Vivi renderer.
- Map only validated semantic cues to subtle expression/ear/tail/head/paw motion: listening → ear perk; thinking → small head tilt and optional thought dots; speaking → audio-level mouth; happy/proud → a light hop; amused → soft giggle; supportive → warm eyes and gentle tail movement; curious/confused/surprised → restrained facial/head changes. Default/invalid input is idle neutral.
- Honor `prefers-reduced-motion`: significant movement and animated effects become static or are removed. Verify that behavior with component/style regressions; do not rely solely on a visual assertion.
- The shared `KruaLive` renderer has call sites beyond the two call screens (VoiceHub, FeedbackView, and Tutor). Keep those consumers build-safe, and if required adapt them to the same semantic contract rather than retaining a legacy shape/sound bypass. This is a necessary renderer integration detail, not a new product feature.

## TDD and implementation order

1. Write failing `src/shared/vivi-cue.test.ts` cases for every whitelist member, all malformed/unknown values, all prohibited examples, neutral fallback, object sanitation, and schema version. Add/extend server tests to prove the server re-export is the same shared validator and retains safe fallback behavior. Add client/controller tests for malicious cue input and safe fallback.
2. Run the focused test command before implementation: `npm test -- src/shared/vivi-cue.test.ts server/vivi-cues.test.ts` (include the relevant client/component test files when added) and record the expected red result.
3. Implement the shared schema and replace duplicate definitions/imports; then implement the minimal semantic animation mapping in existing Mascot/KruaLive patterns, remove unsafe legacy shape/sound action dispatch from the renderer path, and add reduced-motion CSS/regressions.
4. Run focused schema, voice-call, component, and marker tests; then `npm test`, `npm run typecheck`, `npm run build`, and `git diff --check`. Inspect all gate values, the final diff, and the worktree.
5. Update Task 8 plan checkboxes, this brief's implementation status, create `task-8-report.md`, and append the SDD progress ledger. Request independent review of the complete uncommitted diff; handle findings and request a fresh review as needed. Do not stage or commit before the independent review. No review result authorizes provider, API, billing, Live POC, or deployment operations.

## Expected files

Core: new `src/shared/vivi-cue.ts`, `src/shared/vivi-cue.test.ts`; update `server/vivi-cues.ts` and `server/vivi-cues.test.ts`; remove the duplicate `src/engine/voice/vivi-cues.ts` module after updating imports; update `src/components/Mascot.tsx`, `src/components/KruaLive.tsx`, `src/engine/voice/markers.ts`, `src/styles.css`, `src/screens/voice/VoiceCall.tsx`, and `src/screens/voice/LiveCall.tsx` as needed. Because `KruaLive` is shared, adjust only necessary call sites/tests in `src/screens/voice/VoiceHub.tsx`, `src/screens/voice/FeedbackView.tsx`, and `src/screens/Tutor.tsx`; document each such change. Add focused component/client regressions if needed. Update the plan and local SDD artifacts (`task-8-brief.md`, `task-8-report.md`, and `progress.md`).

## Acceptance criteria

- There is one versioned schema/validator implementation; server and client use it, and duplicate enum/validator definitions are gone.
- Every approved enum value is accepted; invalid/malformed/arbitrary values and prohibited actions/shape/sound commands resolve to neutral and cannot trigger an unsafe action.
- Vivi remains recognizably the original cat silhouette; semantic cues map only to subtle intended face, ear, tail, head, mouth, or paw responses. No shape morphing or sound-command execution remains in the affected renderer path.
- Reduced-motion preferences suppress significant movement/effects while preserving legible state.
- Focused and full tests, typecheck, build, and diff-check pass; existing unrelated build warnings, if any, are reported accurately.
- Provider, quota/route-operation, and Live gates remain unchanged false/disabled. No external request, billing/deployment operation, staging, or commit occurs before review.

## Implementation status

- Brief created before application-code edits. Repository inspection confirmed the shared renderer also serves VoiceHub, FeedbackView, and Tutor; only the call-site adjustments required to preserve safety/build integrity are in scope.
- Implemented the single versioned `src/shared/vivi-cue.ts` contract for server and client; `server/vivi-cues.ts` is a compatibility re-export and the duplicate client module is removed. The validator fails closed on invalid/unknown/malformed inputs, unsafe values and legacy sound fields.
- Replaced legacy marker dispatch with safe whitelisted semantic cues; malformed and unclosed sound markers are stripped without swallowing following bracketed safe text. The renderer preserves the existing cat silhouette, uses subtle approved expressions/motions, and honors `prefers-reduced-motion`. Shared renderer call sites were adapted where needed.
- TDD regressions include every enum and invalid-input boundary, schema/version/import behavior, Live cue fallback, reduced motion, sound-marker spelling variants, unclosed tags with later bracketed text, and server vocal-tag sanitization. Focused tests pass (3 files / 90 tests); full `npm test` passes (23 files / 446 tests); `npm run typecheck`, `npm run build`, and `git diff --check` pass.
- Independent final review: **ACCEPT — no actionable findings**. Reviewer independently checked the complete diff, shared schema, marker sanitization, silhouette/motion behavior, reduced-motion handling, and disabled Live state.
- Provider transport, quota/route-operation and Live gates remain false/disabled; no Google auth/API call, paid request, audio generation, billing change, Live POC, or deployment occurred. Changes remain unstaged and uncommitted. Build retains the existing Vite non-module `ads-config.js`/`site-config.js` warnings and the >500 kB chunk warning.


## Scope clarification — legacy Live cue dispatch

Source tracing found that `src/engine/voice/live.ts` can turn model-provided `face`/`gesture`/`sfx` strings into shape changes, fire/flips, or local sound effects before `LiveCall` renders them. The implementation may therefore make a narrow `live.ts` change: normalize only the existing cue-emission boundary through the shared whitelist (invalid/legacy shape/sound/unsafe commands become neutral) and remove direct sound dispatch. This does not alter Live transport/auth/entry behavior, does not enable any gate, and does not run or connect a Live session. The Task 9 Live-disable work remains separate.
