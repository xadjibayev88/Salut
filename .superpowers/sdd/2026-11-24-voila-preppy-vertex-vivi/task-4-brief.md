# Task 4 implementation brief — Google-only provider boundary va ADC transport

## Maqsad va qat’iy chegaralar

Tasdiqlangan rejaning faqat Task 4 qismini `/workspace/.worktrees/voila-preppy-ai-vivi` worktree va `feat/voila-preppy-ai-vivi` branchida amalga oshirish. Bu bosqich provider interfeysi va faqat Google Cloud/Agent Platform adapterlarini tayyorlaydi; provider route’larini ochmaydi. Task 3 `quotaReservationReady` gate’i `false` qoladi; Task 5 barcha handler va fallback’larda quota reservation/settlement’ni ulab mustaqil tekshiruvdan o‘tmaguncha yetti AI route mavjud bo‘lmaydi.

Google API yoqish, haqiqiy ADC credential discovery/token olish, providerga tarmoq so‘rovi, billing/quota o‘zgarishi, paid request, Live POC va deploy taqiqlangan. Barcha testlarda soxta auth/fetch ishlatiladi. Noaniq yoki yetishmagan config, auth xatosi va qo‘llab-quvvatlanmagan provider providerga ham, boshqa provayderga ham so‘rov yubormaydi. Credential yoki token browser bundle, HTTP javob, log yoki xato matniga chiqmaydi. Voilà! fransuz tili A1–C2 doirasida qoladi; IELTS qo‘shilmaydi va GoPrep’ni 1:1 nusxalashga da'vo qilinmaydi.

## Repo holati va bog‘liqliklar

- Worktree `feat/voila-preppy-ai-vivi` branchida va boshlang‘ich holatda toza.
- Task 3 `9bf50a7b1348a8fb542cafd5932537a4587281b3` commitida mustaqil ko‘rib chiqilib yakunlangan. `server/main.ts`-dagi `AI_QUOTA_RESERVATION_MIDDLEWARE_READY = false` gate’i ataylab yopiq; `enabledAiRoutes` testlari barcha yetti AI route’ni quota reservation tayyor bo‘lmaguncha registry’dan olib tashlaydi. Bu qiymat `true` qilib o‘zgartirilmaydi.
- `VIVI_AI_QUOTA_STORE_SHARED_DURABLE_VERIFIED` standart qiymati `false`; production SQLite’ning umumiy va durable storage ekani isbotlanmagan.
- Hozirgi `server/ai-config.ts` faqat `gemini-3.5-flash-lite` tekst model, `asia-southeast1`/`europe-west4` candidate location, hamda operatorning ADC/project attestations’ini ifodalaydi. TTS model/voice va STT recognizer/audio-decoding uchun alohida tasdiqlangan config yo‘q. Ushbu Task’da bu qiymatlar taxminan qo‘shilmaydi, TTS/STT uchun tekst model yoki bitta umumiy location ishlatilmaydi. Adapter’ga kerak service-specific tasdiqlar bo‘lmasa, tegishli amal fail-closed bo‘ladi.
- Eski handler’larda Gemini Developer API, LLM fallback, Azure/ElevenLabs va brauzer STT logikasi bor. Ular yangi provider registry’ga kiritilmaydi; Task 5 route gate’i yopiq qoladi va yangi Google adapter boshqa provayderga fallback qilmaydi. Eski fallback’larni yangi handler/quota integratsiyasiga ulash yoki olib tashlash Task 5’da alohida hal qilinadi.

## Rasmiy API hujjatlaridan topilmalar

- [Agent Platform `generateContent` REST reference](https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/rest/v1/projects.locations.publishers.models/generateContent): `POST https://{service-endpoint}/v1/{model}:generateContent`; publisher model resource’i `projects/{project}/locations/{location}/publishers/{publisher}/models/{model}`; so‘rov/javobdagi `contents`, `systemInstruction`, `generationConfig`, `candidates` shakllari hujjatda berilgan.
- [Agent Platform `streamGenerateContent` REST reference](https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/rest/v1/projects.locations.endpoints/streamGenerateContent): alohida `:streamGenerateContent` POST endpoint; oqim javobi `GenerateContentResponse` obyektlaridan iborat. Hozirgi REST reference legacy Gemini Developer API SSE framing yoki `alt=sse` ishlatilishini tasdiqlamaydi; yangi adapter ularni taxminan qayta ishlatmaydi.
- [Gemini TTS overview](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/text-to-speech/overview): hujjatda hozirgi TTS model’lari `gemini-3.8-flash-tts`, `gemini-3.8-flash-lite-tts`; `generateContent` so‘rovida `responseModalities: ["AUDIO"]`, `speechConfig.voiceConfig.voice`, javobda `candidates[].content.parts[].inlineData.data` ishlatiladi. Unary output WAV, PCM16, 24 kHz mono. TTS location `global`, `us` yoki `eu`; `us`/`eu` uchun alohida host ishlatadi. Bular runtime config’dagi STT/text location’lardan farq qiladi. Hech qanday model yoki voice default qilib tanlanmaydi; project uchun amalda tasdiqlangan qiymat alohida aniqlanadi.
- [Cloud Speech-to-Text V2 `recognize` REST reference](https://docs.cloud.google.com/speech-to-text/docs/reference/rest/v2/projects.locations.recognizers/recognize): `POST https://speech.googleapis.com/v2/{recognizer}:recognize`; recognizer resource project/location/recognizer ma’lumotlarini saqlaydi; request’da `config`, ixtiyoriy `configMask`, va `content` yoki GCS `uri` bo‘ladi; response `results[].alternatives[]` va metadata qaytaradi. [Recognizer `RecognitionConfig` reference](https://docs.cloud.google.com/speech-to-text/docs/reference/rest/v2/projects.locations.recognizers) `model`, `languageCodes`, `autoDecodingConfig`/`explicitDecodingConfig` maydonlarini belgilaydi. [Til va region jadvali](https://docs.cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages) `uz-UZ` + `chirp_2` uchun `asia-southeast1`, `fr-FR` + `chirp_2` uchun `europe-west4`ni ko‘rsatadi; bu project’da ruxsat borligini tasdiqlamaydi. Adapter audio codec/sample rate’ni MIME string’dan taxmin qilmaydi.
- [Application Default Credentials’ning rasmiy izohi](https://docs.cloud.google.com/docs/authentication/application-default-credentials) ADC credential qidirish tartibi va production attached service account haqida ma’lumot beradi. [Google Auth Library for Node.js](https://github.com/googleapis/google-auth-library-nodejs) ADC client, `https://www.googleapis.com/auth/cloud-platform` scope va serverdan request qilish misolini beradi. Bu Task credential izlamaydi yoki tekshirmaydi; faqat server tomondagi injected auth interfeysidan foydalanadi.
- [Agent Platform’ning 429 bo‘yicha ko‘rsatmasi](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/deploy/error-code-429) truncated exponential backoff’ni tavsiya qiladi. Tekshirilgan `generateContent`, `streamGenerateContent`, STT `recognize` REST contract’larida upstream idempotency/request ID kafolati topilmadi. Shu sabab timeout, 429 yoki 5xx’dan keyin POST avtomatik qayta yuborilmaydi. Qaror: **no retry until a documented provider idempotency contract is available.** Bu takroriy billable so‘rov xavfini kamaytirish uchun tasdiqlangan rejadagi “one sequential idempotent retry” bandidan ochiq va ehtiyotkor istisnodir.

## Amalga oshirish yondashuvi

1. `server/ai-provider.ts`-da `streamTutor`, `generateJson`, `transcribe`, `synthesize` metodlari bilan server-side `AiProvider` interfeysi hamda faqat nomlangan `google-agent-platform` provider registry aniqlanadi. Noma’lum/qo‘llab-quvvatlanmagan provider uchun provider yaratilmaydi va boshqa vendor’ga o‘tuvchi fallback metodi bo‘lmaydi.
2. `server/google-cloud-provider.ts` faqat rasmiy request/response schema’larining typed adapter’i bo‘ladi. `createGoogleCloudProvider(config, { auth, fetchImpl })` auth header provider va `fetch`ni dependency injection orqali oladi. Ixtiyoriy base URL, browser credential, Gemini Developer API key, Azure/ElevenLabs/OpenAI-compatible provider qo‘shilmaydi. Service-specific model/location/voice/recognizer/config qiymatlari to‘liq va tasdiqlangan bo‘lmasa, method auth yoki fetch chaqirmasdan fail-closed qaytadi. Endpoint host/resource faqat ruxsat etilgan Google API shakllarida tuziladi.
3. Auth olish muvaffaqiyatsiz bo‘lsa provider fetch 0 marta chaqiriladi; Google HTTP/network xatosidan keyin boshqa provider ishga tushmaydi. Xato UI uchun xavfsiz, secret-siz shaklda bo‘ladi. Adapter va registry faqat `server/` ichida qoladi; client kod ularni import qilmaydi.
4. `server/tutor.ts`, `server/voice.ts`, `server/main.ts` fayllarida interfeysga moslashtirish, eski provider fallback’ni yangi registry’ga kiritmaslik va server route gate yopiq qolishini tasdiqlash uchun zarur minimal o‘zgarishlar kiritiladi. Task 5’da handler quota integration qilinmaydi; barcha AI route va Live disabled qoladi.
5. Testlar to‘liq soxta auth/fetch ishlatadi: faqat kutilgan Google URL va payload; auth/config yo‘q bo‘lsa fetch=0; auth xatosi, unsupported provider va upstream xatoda boshqa provider fetch=0; text/STT/TTS response parse; hujjat bilan tasdiqlanmagan framing taxmin qilinmasligi; token/credential browser va log’da ko‘rinmasligi; readiness false bo‘lganda 7 AI route registry’ga kirmasligi.

## Kutilayotgan fayllar va tekshiruvlar

Kutilayotgan fayllar: yangi `server/ai-provider.ts`, `server/ai-provider.test.ts`, `server/google-cloud-provider.ts`, `server/google-cloud-provider.test.ts`; zarur bo‘lsa o‘zgartiriladigan `server/tutor.ts`, `server/tutor.test.ts`, `server/voice.ts`, `server/voice.test.ts`, `server/main.ts`; ushbu brief va keyin SDD `progress.md`, `task-4-report.md`.

TDD tartibi: avval fake transport ishlatadigan yiqiluvchi testlar, so‘ng minimal adapter, oxirida quyidagilar:

```sh
npm test -- server/ai-provider.test.ts server/google-cloud-provider.test.ts
npm run typecheck
```

Ish tugagach `progress.md` va Task 4 hisobotini yangilash; git commit qilmaslik. Yakuniy natijada o‘zgargan fayllar, focused tests/typecheck natijasi, rasmiy source linklar va ochiq config/retry/storage xavflari ko‘rsatiladi.

## Qabul mezonlari va ish doirasidan tashqaridagilar

Adapter’larning barcha network access’i injected fake orqali tekshiriladi; missing/unverified config, auth xatosi yoki unsupported provider Google’ga ham, boshqa vendor’ga ham fetch qilmaydi; secrets browser/error/log’da ko‘rinmaydi; AI route’lar Task 5 gacha yopiq; Live doim disabled; runtime config’dan taxminiy TTS model/voice/location olinmaydi. Haqiqiy ADC/token lookup, Google yoki boshqa vendor network request’i, API enablement/billing, deploy va commit bajarilmaydi.
