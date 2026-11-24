# Task 7 implementation brief — tutor behavior, Vivi cue wire contract, and text-only TTS cascade

## Goal and approved boundaries

Implement only Task 7 of `docs/superpowers/plans/2026-11-24-voila-preppy-vertex-vivi.md` in `/workspace/.worktrees/voila-preppy-ai-vivi` on `feat/voila-preppy-ai-vivi`. Follow the binding design and SDD ruling that Task 7 owns a server-side cue validator and Task 8 will later promote the exact same whitelist to a shared client/server schema. Preserve the Task 6 rule: only an explicitly confirmed transcript may reach the tutor.

This is code, fake-provider, and metadata-only work. Never call Google/ADC, generate or send real text/audio to a provider, enable a provider/readiness gate, change billing, run Live POC, or deploy. Keep provider integration fake-only and all readiness/Live gates false; do not claim 1:1 replication of GoPrep. Keep Voilà! focused on French A1–C2, not IELTS. Do not stage or commit before an independent ACCEPT; after ACCEPT, stage and commit only the explicitly scoped Task 7 files.

## Repository findings

- `server/tutor.ts` currently has mode- and character-specific prompts that mandate jokes/terms of endearment in places, allow insulting behavior, and permit raw shape/action/SFX marker strings. Legacy Gemini and fallback helpers also remain in the file, but the production AI route table is gated off and has no provider transport installed; do not activate or broaden those paths.
- `server/voice.ts` builds separate feedback/STT/TTS prompts. Its feedback prompt must share the tutor's core French/Uzbek teaching rules; STT-specific transcription rules remain distinct.
- `server/ai-route-operations.ts` is the route-specific result-minimization boundary. The tutor result must become `{ text, cue }` only after its cue is normalized by the server validator. AI route readiness remains false.
- `src/engine/tutor.ts` and `src/engine/voice/call.ts` currently consume only `{t}` SSE frames. The voice call pushes sentence audio while tutor text is still streaming. `src/engine/voice/markers.ts` can turn raw model marker strings into legacy actions/SFX.
- `src/engine/voice/tts.ts` currently falls back to local browser speech when the configured remote TTS request fails; the public voice config currently reports browser TTS even though no provider/voice has been verified.
- Existing Task 6 controller ensures the user must confirm/edit the STT transcript before tutor submission. Preserve that behavior.

## Design

1. Export one core tutor behavior contract used by text and voice tutor prompts and by voice feedback instructions: French practice at the learner's CEFR level A1–C2; natural, concise Uzbek Latin explanation by default; optional, gentle, situation-appropriate humor; never ridicule or humiliate; do not reject valid French variants; at most one short, important correction per ordinary turn. Remove contradictory mandatory humor, insulting examples, shape-morph/SFX/action-marker instructions from these prompt paths without broadening unrelated UI character behavior.
2. Add `server/vivi-cues.ts` with the Task 8 whitelist exactly: state `idle|listening|thinking|speaking`; face `neutral|happy|amused|curious|confused|surprised|supportive|proud`; action `blink|head_tilt|ear_perk|tail_wag|giggle|hop|wave`; optional single ornament `sparkle|thought_dots|heart`. Validation strips unknown fields and maps malformed/unknown cue values to a fully neutral cue. It must not pass model-supplied command strings to clients.
3. Require structured tutor output `{text, cue}` in the minimized prompt and normalize it server-side. Provide a small, testable SSE encoder that emits the validated text as `{t: string}` and the cue in a separate `{cue: ViviCue}` event. Plain/unparseable text remains text-only with neutral cue; cue invalidity must not erase usable tutor text. Strip legacy executable marker syntax from text before the client receives it. Client decoders treat cue as metadata; raw text cannot trigger mascot actions.
4. Preserve the Task 6 confirmation boundary and make voice sequencing explicit: confirmed transcript → completed tutor text/cue → optional TTS. Do not begin speech while text is still arriving. Since no TTS provider/voice quality has been verified, the default and all provider-failure paths are text-only; do not silently fall back to browser/another provider. A failed/unverified TTS must leave the complete tutor text visible and allow the learner to continue/retry. Keep the provider fake-only and disabled.
5. Document a human listening gate with at least 20 representative Uzbek and mixed Uzbek–French text examples and a review checklist (Uzbek pronunciation/naturalness, French pronunciation/word boundaries, code-switch quality, intelligibility, tone, latency). This is a future release gate only: do not generate audio or claim it passed.

## TDD and implementation order

1. Add failing tests in tutor tests for A1–C2 French practice, concise/natural Uzbek default explanation, optional humor, acceptance of valid French alternatives, and no more than one short important correction. Run `npm test -- server/tutor.test.ts` to capture the red baseline.
2. Add cue validator and wire-format tests first; assert every whitelist member is accepted, prohibited/malformed/arbitrary values become neutral, text and cue are separate SSE events, and malicious/raw action strings never reach the client cue.
3. Add fake-only route-operation tests for structured tutor normalization and marker stripping. Do not connect a real provider or change the disabled route registration/readiness.
4. Add client parser/controller/TTS tests proving `{t}` and `{cue}` remain separate, only confirmed transcript starts the tutor request, no sentence audio starts before text completion, and TTS unavailable/failure returns visible text with no local/alternate-provider fallback.
5. Implement the smallest changes in the existing code patterns; run focused suites, `npm run typecheck`, `npm run build`, and `git diff --check`. Inspect readiness values and the final diff.
6. Update the plan Task 7 checkboxes, this brief, `task-7-report.md`, and `.superpowers/sdd/2026-11-24-voila-preppy-vertex-vivi/progress.md`. Request independent review of the final diff and do not stage/commit before its result.

## Expected files

Planned: `server/tutor.ts`, `server/tutor.test.ts`, `server/voice.ts`, new `server/vivi-cues.ts` and `server/vivi-cues.test.ts`, `src/engine/tutor.ts`, `src/engine/voice/tts.ts`, `src/engine/voice/call.ts`, and relevant tests. If the existing integration boundary requires it, also update `server/ai-route-operations.ts` and its tests, `server/main.ts` voice capability metadata, `src/screens/voice/VoiceCall.tsx` notice copy, or corresponding test files; document why. Do not touch unrelated files or the Task 8 visual mapping.

## Acceptance criteria

- Tutor and voice feedback share the specified behavior contract; no mandatory joke, insulting tutor behavior, or model-generated animation/SFX command remains in these new prompt paths.
- A1–C2 and French-valid-alternative/correction-count regressions pass.
- Server validates a structured cue against the exact Task 8 whitelist and sends text and cue as separate SSE events. Invalid cue safely becomes neutral; free-form model action strings never drive animation.
- Voice still requires confirmed transcript. Tutor text completes before any optional speech; unverified/failed TTS leaves text-only output and has no hidden fallback.
- At least 20 future human TTS evaluation examples and criteria are documented; no audio is generated.
- Focused tests, typecheck, build and diff-check pass; all provider, quota, Live and deployment gates remain unchanged and false/disabled. No staging or commit before independent review.

## Implementation status

- Implemented the shared tutor contract, server cue validator and separate text/cue SSE events; the client treats cue data as metadata and requires an explicit completion event before persisting a tutor turn or starting voice TTS. Incomplete streams clear transient text/cue, persist no assistant turn, queue no speech, and preserve the confirmed user draft for retry. Text chat aborts and failed/incomplete streams also cannot persist partial assistant text; voice barge-in discards an unfinished tutor stream instead of adding it to history.
- Server TTS remains text-only while unverified, with no hidden browser-speech fallback; separately, text-tutor French-segment playback uses browser/device `SpeechSynthesis` by default on new profiles and is user-toggleable. The privacy disclosure states that the selected engine’s own privacy behavior applies. The human listening gate is documented with 24 Uzbek/mixed examples in `task-7-report.md`; no audio was generated.
- Final verification: focused Task 7 suites (8 files / 197 tests) and full `npm test` (21 files / 373 tests) PASS; `npm run typecheck`, `npm run build`, and `git diff --check` PASS. Existing Vite script-tag and large-chunk warnings remain.
- The latest final independent review in `task-7-review.md` gives ACCEPT and confirms all five findings resolved, with all provider/readiness/Live gates false/disabled. The ACCEPT authorizes only the scoped Task 7 commit; the review artifact and unrelated ignored files are excluded.
