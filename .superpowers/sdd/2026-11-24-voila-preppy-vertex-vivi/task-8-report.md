# Task 8 report — one safe Vivi cue schema and recognizable cat animation

## What changed

Client and server now use the same versioned cue contract in `src/shared/vivi-cue.ts`; the server module only re-exports it, and the duplicate client schema is removed. It accepts only the approved states, faces, gestures, and ornaments. Invalid, unknown, malformed, unsafe, sound-effect, or shape-changing input falls back safely rather than dispatching an unapproved action.

The legacy marker handlers no longer execute sound or unsafe commands. Client and server regressions cover `soundeffect`, `sound-effect`, and `sound_effect`, malformed/unclosed brackets, safe text that follows a malformed marker (including bracketed text), and legacy vocal tags. When stripping malformed commands, following learner-facing text is preserved.

Vivi keeps the existing cat silhouette. The shared renderer maps approved cues to restrained facial, ear, head, tail, paw, and speaking-mouth responses; shape morphing and unsafe effects were removed from that path. `prefers-reduced-motion` suppresses the significant movement and animated effects. Shared renderer call sites were adjusted only as needed to use the common semantic contract.

## Verification

- Focused final client/server tutor suites: **PASS — 3 files, 90 tests**.
- Full `npm test`: **PASS — 23 files, 446 tests**.
- `npm run typecheck`: **PASS**.
- `npm run build`: **PASS**. Existing Vite warnings remain for non-module `ads-config.js` and `site-config.js` script tags and the client bundle above 500 kB.
- `git diff --check`: **PASS**.
- Independent final review of the complete Task 8 diff: **ACCEPT — no actionable findings**. The reviewer also independently ran focused and full tests, typecheck, build, and diff-check successfully.

## Boundaries and remaining caveat

Google/provider transport, quota/route-operation readiness, and Live remain false or disabled. No real auth/API call, paid request, audio generation, billing change, Live POC, or deployment occurred. The build warnings noted above predate this task and do not fail the build. Changes remain unstaged and uncommitted on `feat/voila-preppy-ai-vivi`.

Key implementation files include `src/shared/vivi-cue.ts`, `server/vivi-cues.ts`, `src/components/Mascot.tsx`, `src/components/KruaLive.tsx`, `src/engine/voice/markers.ts`, `src/engine/voice/live.ts`, and `src/styles.css`, with corresponding schema, component, client, server, and Live regressions.
