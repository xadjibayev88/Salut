# HANGUL STROKE — Go Topic showreel (15 s)

**G'oya:** bitta chiziq — Hangul'ning ㅣ harfi — butun videoni o'zi quradi: chiziq → so'zlar → ㅇ ㅁ ㅅ → 3D → TOPIK grafigi → ilova interfeysi → HANGUL / TOPIK / HORI AI → «Go Topic» → yana chiziq (halqa).

Tayyor videolar: `../motion/g-showreel.mp4` (9:16, Instagram) va `../motion/g-showreel-16x9.mp4` (16:9).

## Qoidalar
- 120 BPM, 30 zarb (har zarb 0.5 s). Har zarbda harakat bor. Har taktga bitta usul, eng kuchli lahza oxirgi to'liq taktda, sarlavha oxirgi yarim taktda. Birinchi va oxirgi kadr bir xil (halqa).
- Bitta shrift: Noto Sans KR. Ranglar: `#6D4AFF`, `#FF3B5C`, `#2BB8F0`, qora `#0B0B10`, oq `#F4F2EE`.
- Hamma uslub `window.seek(t)` ichida vaqtdan hisoblanadi (CSS animatsiya yo'q). Easing — eksponensial va kritik so'ndirilgan prujina. Harakat xiraligi har bir obyektning ekrandagi tezligi va yo'nalishiga qarab hisoblanadi.
- Kamera tili bitta: sekin «push-in» va bitta orbital kamera.

## Zarbma-zarb
| Takt | Zarb | Nima bo'ladi |
|---|---|---|
| 1 · ilmoq | 1–4 | Marjon chiziq yoyiladi; KOREYS / TILI / ENDI O'YIN chiziqdan bittadan ko'tariladi |
| 2 · Hangul | 5–8 | So'zlar uchib ketadi, 한국어 chiqadi → bo'g'inlar sochiladi → chiziq 90° burilib ㅣ bo'ladi → uchga bo'linadi |
| 3 · shakl | 9–12 | Ustunlar ㅇ ㅁ ㅅ ga aylanadi → yoy bo'ylab o'rin almashadi → 3×2 to'rga bo'linadi → kamera buriladi |
| 4 · 2D→3D | 13–16 | To'r fazoga yotadi → kataklar 3D ustunlarga o'sadi → kamera aylanadi → ustunlar qatorga tizilib grafik bo'ladi |
| 5 · ma'lumot | 17–20 | O'q, T1…T6, «SO'Z BOYLIGI» → raqamlar 800 … 30 000 gacha sanaladi → chiziqli grafik → ustunlar tushadi |
| 6 · interfeys | 21–24 | Grafik chizig'i slayderga aylanadi, karta chiziladi → 70% → «Hori AI ustoz» yoqiladi → «Hangul 100%» (riser) |
| 7 · cho'qqi | 25–28 | Satrlar to'liq ekranli tekisliklarga o'sadi → HANGUL / TOPIK / HORI AI ag'dariladi → bitta marjon tekislikka urilish |
| ½ · sarlavha | 29–30 | Tekislik chiziqqa siqiladi, «Go Topic» chiqadi → chiziq boshlang'ich uzunligiga qaytadi |

Ovoz: har zarbda kick, ofbitlarda hat, F minor akkordlari (Fm–D♭–A♭–E♭) va bas kick ostida «nafas oladi». 6-taktda riser va snare roll, har takt boshida hit, 7-taktda clap. Bir nechta harakat ovozi `media/sfx` to'plamidan olingan. Hammasi `OfflineAudioContext` ichida render qilinadi.

## Qayta render qilish
Talab: Node + `playwright` (Chromium), `ffmpeg`, shrift uchun internet. Buyruqlarni shu papkadan ishga tushiring; `h` — 16:9, `v` — 9:16:

```bash
node beats.cjs 1920 1080 h            # har zarbdan bitta kadr → beats-h/ (tekshiruv)
node render.cjs 1920 1080 h 4 png     # 60 fps × 3 subkadr = 2700 kadr → frames-h/
node audio.cjs                        # soundtrack.wav
ffmpeg -framerate 180 -i frames-h/%05d.png -i soundtrack.wav \
  -filter_complex "[0:v]tmix=frames=3,select='eq(mod(n\,3)\,2)',setpts=N/(60*TB),scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[v]" \
  -map "[v]" -map 1:a -r 60 -c:v libx264 -preset slow -crf 16 -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -b:a 256k -movflags +faststart -t 15 showreel-16x9.mp4
```
9:16 uchun `1080 1920 v` va `frames-v/` ishlating. Matnni o'zgartirish uchun `reel.html` dagi `WORDS`, `HAN` va sarlavha qatorlarini tahrirlang.
