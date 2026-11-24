# Task 4: Google-only provider boundary ва server transport

## Натижа

Server tomonida зөвхөн Google Agent Platform болон Cloud Speech API-д зориулсан provider interface, registry, adapter нэмэгдлээ. Auth болон `fetch` заавал injected байна; runtime auth, глобал `fetch`, дурын base URL эсвэл vendor fallback ашиглахгүй. Adapter-ийг үндсэн server handler-т холбосонгүй, Google-д бодит хүсэлт явуулаагүй.

Voilà! франц хэлний A1–C2 хүрээ хэвээр; IELTS нэмээгүй, GoPrep-ийг 1:1 хуулсан гэж мэдэгдээгүй.

## Хийсэн ажил

- `AiProvider` нь tutor text, JSON, STT, TTS интерфейсийг тодорхойлж, registry зөвхөн `google-agent-platform`-ийг зөвшөөрнө. Unknown provider, давхар бүртгэл эсвэл хоосон registry өөр provider руу шилжихгүй.
- Google adapter нь шалгагдсан project/model/location болон үйлчилгээ тус бүрийн тохиргоог шалгасны дараа л injected auth болон injected fetch дуудаж, Google Cloud scope ашиглана. Auth алдаа, HTTP/network алдаа болон буруу response-д credential, upstream body агуулдаггүй аюулгүй алдаа буцаана.
- Independent review-ийн хоёр P2 засагдсан: `response.json()`/body унших явцад signal abort бол `request_aborted` гарна; TTS WAV одоо RIFF/WAVE хэмжээ, form, chunk бүтэц, формат хэсэг, өгөгдлийн хэсэг болон PCM alignment-ийг шалгана.
- Fake transport тестүүд text JSON, unary text, STT `recognize`, TTS-ийн хүчинтэй PCM WAV, malformed/truncated WAV, config/location validation, unsupported provider, auth failure, secret leakage болон auth/body унших үеийн cancellation-ийг хамарна.
- Adapter зөвхөн `server/` дотор байна. Browser `src/` кодоос import байхгүй; adapter registry-г main handler-тэй холбосонгүй.

## Шалгалтын дүн

- Шинэ regression тестүүдийг эхлээд хуучин код дээр ажиллуулахад хоёр P2 алдаа давтагдсан: body abort `invalid_response` болсон, дөрвөн байт `RIFF` WAV мэт зөвшөөрөгдсөн.
- `npm test -- server/ai-provider.test.ts server/google-cloud-provider.test.ts` — засварын дараа амжилттай, 2 файл / 20 тест.
- `npm run typecheck` — амжилттай.
- Кодын шалгалтаар `GOOGLE_PROVIDER_TRANSPORT_READY = false`, `AI_QUOTA_RESERVATION_MIDDLEWARE_READY = false` хэвээр байна. Иймээс AI route идэвхжээгүй; Task 5 quota reservation/settlement wiring ба review хийгдээгүй.
- Бодит ADC credential хайлт, Google network request, API enablement, billing өөрчлөлт, paid request, Live POC болон deploy хийгдээгүй. Зөвхөн injected fake auth/fetch ашигласан.

## Одоогийн хязгаарлалт ба үлдсэн ажил

- `streamTutor` нь documented `generateContent` unary JSON endpoint-оос бүтэн хариуг авч, нэг application chunk болгон өгнө. `streamGenerateContent` REST баримт `GenerateContentResponse` объектын урсгалыг тайлбарладаг ч энд хэрэгтэй wire framing-ийг тогтоогоогүй тул parser таамаглаагүй; жинхэнэ incremental streaming хараахан алга.
- TTS model/location/voice болон STT model/location/recognizer-ийн project-level баталгаажсан production config байхгүй. Adapter эдгээр утгыг өөрөө сонгохгүй; тохиргоо дутвал хүсэлт auth эсвэл fetch хүрэхээс өмнө зогсоно. Fake test-д л explicit утга өгсөн.
- Дахин оролдлого хийгдэхгүй: **no retry until a documented provider idempotency contract is available.** Google-ийн 429 зааварт backoff зөвлөдөг ч шалгасан REST contract-ууд upstream idempotency key/баталгааг тогтоохгүй; timeout/429/5xx-ийн дараа POST дахин илгээх нь billable хүсэлтийг давхардуулах эрсдэлтэй. Энэ нь төлөвлөгөөний “one sequential idempotent retry” мөрөөс зориуд гаргасан, Task 4 brief болон SDD ledger-т мөн бүртгэсэн variance юм.

## Өөрчилсөн файлууд

- `server/ai-provider.ts`
- `server/ai-provider.test.ts`
- `server/google-cloud-provider.ts`
- `server/google-cloud-provider.test.ts`
- `.superpowers/sdd/2026-11-24-voila-preppy-vertex-vivi/task-4-brief.md`
- `.superpowers/sdd/2026-11-24-voila-preppy-vertex-vivi/progress.md`
- `.superpowers/sdd/2026-11-24-voila-preppy-vertex-vivi/task-4-report.md`

Commit хийгээгүй; хоёр P2 засвар хийгдсэн бөгөөд independent re-review хүлээж байна.

## Ашигласан албан ёсны эх сурвалж

- Google Agent Platform [`generateContent` REST](https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/rest/v1/projects.locations.publishers.models/generateContent) болон [`streamGenerateContent` REST](https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/rest/v1/projects.locations.endpoints/streamGenerateContent): request/response ба streaming contract.
- Google [Gemini TTS overview](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/text-to-speech/overview): TTS-ийн `speechConfig.voiceConfig.voice`, `responseModalities: ["AUDIO"]`, WAV output болон бүсчилсэн endpoint.
- Cloud Speech-to-Text V2 [`recognize`](https://docs.cloud.google.com/speech-to-text/docs/reference/rest/v2/projects.locations.recognizers/recognize), [`RecognitionConfig`](https://docs.cloud.google.com/speech-to-text/docs/reference/rest/v2/projects.locations.recognizers), [supported languages ба locations](https://docs.cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages): recognizer path, request fields, `chirp_2`-ийн хэл/бүсийн шаардлага.
- Google Cloud [Application Default Credentials](https://docs.cloud.google.com/docs/authentication/application-default-credentials) болон [Google Auth Library for Node.js](https://github.com/googleapis/google-auth-library-nodejs): серверийн auth загвар ба cloud-platform scope.
- Google Agent Platform-ийн [429 алдааны заавар](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/deploy/error-code-429): backoff зөвлөмж; энд documented idempotency амлалт гэж үзээгүй.
- Google [Agent Platform REST reference](https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/rest).
