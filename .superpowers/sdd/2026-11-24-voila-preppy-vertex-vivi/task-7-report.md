# Task 7 report — French tutor behavior, safe Vivi cues, and text-first voice flow

## What changed

Voilà!’s text and voice tutor prompts now use the same teaching contract: French practice from CEFR A1–C2, concise natural Uzbek explanations by default, optional gentle humor, acceptance of valid French alternatives, and at most one short correction for a clear, important error. Voice-session feedback uses the same contract and its output sanitizer caps growth feedback at one item.

Tutor responses are normalized as `{ text, cue }` on the server. The server validates cues against the approved Task 8 enum whitelist, removes unknown fields, and maps malformed or disallowed cues to a neutral value. Legacy action/effect markers are stripped from learner-facing text. The server sends text and the validated cue as separate SSE events; the client treats cue data as metadata and never derives mascot actions from raw tutor text. Task 8 will consolidate the temporary client mirror into a shared schema, as the SDD ruling specifies.

VoiceCall still waits for an explicitly confirmed transcript. A session with saved memory now shows a static local greeting and makes no tutor POST or TTS request at startup. Each confirmed submission makes at most one tutor POST; stalled or ambiguous failures return to the existing manual retry path without repeating the POST automatically. The server rejects missing, empty, or whitespace-only normalized tutor text before emitting SSE completion; text and voice clients also reject blank completed streams, so no `...` placeholder or empty assistant turn is persisted. Voice retains the confirmed draft for retry and queues no TTS on blank replies. Incomplete, failed, aborted, or interrupted streams do not persist partial assistant text; interruption also clears the transient cue. Server TTS remains text-only while provider/voice quality is unverified, and server TTS failures do not fall back to browser speech.

The text tutor’s French-segment playback uses browser/device `SpeechSynthesis` by default on a new profile (`tutorVoice` is default-on and user-toggleable); its text-to-speech processing follows the selected browser/device engine’s own privacy behavior and may depend on the chosen voice. This is separate from the disabled, text-only server TTS path: the server does not silently substitute browser speech when server TTS is unavailable or fails.

## Verification

- Focused Task 7 regression suites: **PASS — 8 files, 197 tests** (`server/tutor.test.ts`, `server/voice.test.ts`, `server/ai-routes.test.ts`, `server/vivi-cues.test.ts`, `src/engine/tutor.test.ts`, `src/engine/voice/call.test.ts`, `src/engine/voice/voice.test.ts`, `src/screens/voice/VoiceCall.test.tsx`).
- Full `npm test`: **PASS — 21 files, 373 tests**.
- `npm run typecheck`: **PASS**.
- `npm run build`: **PASS**. Existing Vite warnings remain for non-module `ads-config.js`/`site-config.js` script tags and the client chunk above 500 kB.
- `git diff --check`: **PASS**.
- Regression coverage includes memory startup with zero tutor/TTS requests, one POST before a manual retry on stall/network ambiguity, blank/missing tutor text in server SSE and both clients, retained confirmed draft with no voice TTS/assistant turn, and cue-before-done interruption cleanup. Route, response parser, cue validator, transcript, TTS, persistence, and barge-in tests use fakes/local metadata only.

## Future human TTS listening gate (not run)

No audio was generated or sent to a provider for this task. Before enabling any TTS provider/voice, a human reviewer should listen to each item in the actual intended configuration and record: (1) intelligibility, (2) natural Uzbek pronunciation and rhythm, including `o‘`/`g‘`, (3) French pronunciation and word boundaries, (4) Uzbek–French code-switch quality, (5) names, accents, numbers and punctuation handling, (6) tone and pacing, and (7) latency and any clipped or missing text. Rate each dimension 1–5 and note the specific words or timestamps that need review. Any unintelligible, materially mispronounced, clipped, or language-confused result blocks enabling that voice until corrected and re-evaluated. Record the voice/model/configuration used and obtain owner sign-off; this checklist is a release gate, not evidence of quality or a claim that it has passed.

Representative text set:

| # | Language mix | Text to evaluate |
|---|---|---|
| 1 | Uzbek | Bugun darsni sekin boshlaymiz. |
| 2 | Uzbek | Iltimos, gapni bir marta qaytaring. |
| 3 | Uzbek | Javobingiz to‘g‘ri, davom etamiz. |
| 4 | Uzbek | O‘ va g‘ tovushlariga alohida e’tibor bering. |
| 5 | Uzbek | Xato qilish — o‘rganishning tabiiy qismi. |
| 6 | Uzbek | Bugun ob-havo haqida uchta sodda gap tuzing. |
| 7 | Uzbek + French | Bonjour ! Bugun kafeda buyurtma berishni mashq qilamiz. |
| 8 | French + Uzbek | Je voudrais un café. Bu muloyim buyurtma. |
| 9 | French + Uzbek | Je m’appelle Ali. «Mening ismim Ali», deb o‘zingizni tanishtiring. |
| 10 | French + Uzbek | J’aime apprendre le français. Bu yerda j’aime — «men yoqtiraman». |
| 11 | French + Uzbek | Je vais au marché. Vais so‘zi bu gapda «boraman» degani. |
| 12 | French + Uzbek | Vous avez raison. Demak, «Siz haqsiz». |
| 13 | French + Uzbek | L’addition, s’il vous plaît. Hisobni muloyim so‘rash usuli. |
| 14 | French + Uzbek | Je ne comprends pas. Bu «Tushunmadim» degani. |
| 15 | French + Uzbek | Qu’est-ce que vous recommandez ? Restoranda tavsiya so‘rash uchun ishlating. |
| 16 | French + Uzbek | Je voudrais deux croissants et un thé. Buyurtmangiz tayyor. |
| 17 | French + Uzbek | Comment ça va ? «Ishlaringiz qalay?» deb so‘raydi. |
| 18 | French + Uzbek | J’habite à Tachkent, mais je voudrais visiter Lyon. |
| 19 | French + Uzbek | Hier, je suis allé au musée. «Kecha muzeyga bordim», degani. |
| 20 | French + Uzbek | Merci beaucoup ! Rahmat, endi siz bitta gap bilan javob bering. |
| 21 | French + Uzbek | Est-ce que je peux avoir un verre d’eau ? Bu muloyim iltimos shakli. |
| 22 | French + Uzbek | Nous allons prendre le train à huit heures. Poyezd soat sakkizda jo‘naydi. |
| 23 | French + Uzbek | À gauche, puis tout droit — chapga, keyin to‘g‘riga yuring. |
| 24 | French + Uzbek | Je préfère le thé, mais aujourd’hui je vais choisir un café. Qaysi ichimlikni siz tanlaysiz? |

## Boundaries and remaining work

Provider integration remains fake-only. Google/provider transport readiness, AI route readiness, production shared-quota readiness, and Live remain false/disabled. No real Google auth/API call, paid text or audio request, billing change, Live POC, or deployment was performed. This report does not establish TTS quality or production provider readiness. The client/server cue schema remains intentionally duplicated until Task 8.

The latest final independent review in `task-7-review.md` gives **ACCEPT** for commit and confirms all five original findings are resolved, with provider, quota/operations, and Live gates still false/disabled. It specifically verified the corrected default-on browser/device `SpeechSynthesis` disclosure against the application default and playback/toggle code, and found no remaining Task 7 blocker. The privacy/runtime regression checks the actual `initialState().settings.tutorVoice` default, automatic text-tutor playback wiring, and disclosure distinction. Final verification passed: focused Task 7 tests (8 files / 197 tests), full `npm test` (21 files / 373 tests), `npm run typecheck`, `npm run build`, and `git diff --check`. The build retains the known Vite warnings for script tags and the >500 kB client chunk. Remaining activation risks are unchanged: provider transport and production quota/readiness are unverified and disabled, TTS voice quality has not passed human listening evaluation, Live remains disabled, and the client/server cue schema remains duplicated until Task 8. The ACCEPT authorizes only the scoped Task 7 source/tests, approved plan update, and Task 7 brief/report/progress ledger; `task-7-review.md` and unrelated ignored files are excluded.
