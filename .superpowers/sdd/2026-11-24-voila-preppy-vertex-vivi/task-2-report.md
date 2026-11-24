## Status
Task 2 va mustaqil review'dan keyingi fix round yakunlandi. Tutor va Live prompt'lariga saqlangan xotira faqat imzolangan hisobda alohida `memory` roziligi faol bo'lsa kiradi. Matnli va ovozli suhbat oqimlari memory endpoint'iga yuboriladigan aniq turn'larni oldindan ko'rsatadi; endpoint faqat foydalanuvchi aniq tasdiqlagandan keyin chaqiriladi. `/api/live/token` route'i `liveEnabled=false` bo'lsa, `providerEnabled=true` bo'lgan holatda ham registryga qo'shilmaydi. IELTS funksiyasi qo'shilmadi.

## Commit(s)
- `959eb781b3d3d1acd494f5118381279bc4796e94` — `feat(ai): add versioned server-side consent`
- `470b5267dfc1c69b55fd0c914a78a142dc1fb3d1` — `fix(ai): require consent for memory and gate Live route`

## Tests
Focused regressiyalar: `npm test -- server/ai-consent.test.ts server/ai-routes.test.ts src/engine/tutor-memory.test.ts` — 3 file / 16 test o'tdi. Ular memory scope yo'q yoki bekor qilingan bo'lsa context'tan memory olib tashlanishini, tasdiqlanmagan turn'larda `fetch` chaqirilmasligini, tasdiqlangan turn'lar yuborilishini va Live route gate'ini tekshiradi. To'liq `npm test` — 13 file / 130 test o'tdi. `npm run build` va `git diff --check` muvaffaqiyatli. Provider o'chirilgan lokal smoke-testda `POST /api/live/token` HTTP 404 qaytardi.

## Concerns
Provider ishlashi, billing va deployment o'chiq qoldi; Google/provider so'rovi qilinmadi. Build'da mavjud Vite ogohlantirishlari saqlanadi: `ads-config.js` va `site-config.js` modul skripti emas; asosiy JS chunk 500 kB dan katta.

## Report path
`/workspace/.worktrees/voila-preppy-ai-vivi/.superpowers/sdd/2026-11-24-voila-preppy-vertex-vivi/task-2-report.md`
