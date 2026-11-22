import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './state/store';
import { AccountProvider } from './state/account';
import './styles.css';
import { initTheme } from './engine/theme';

initTheme();

// Yengil rejim: sekin qurilmalarda (kam xotira/protsessor) shisha blur o'chiriladi — ilova qotmaydi.
try {
  const saved = localStorage.getItem('salut.lite');
  const nav = navigator as Navigator & { deviceMemory?: number };
  const weak = (nav.deviceMemory ?? 8) <= 3 || (navigator.hardwareConcurrency ?? 8) <= 3;
  if (saved === '1' || (saved !== '0' && weak)) document.documentElement.classList.add('lite');
} catch {
  /* e'tiborsiz */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <AccountProvider>
        <App />
      </AccountProvider>
    </StoreProvider>
  </StrictMode>,
);

declare const __BUILD__: string;

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    // Versiya sw.js manzilida — har build'da yangi service worker o'rnatiladi va eski kesh o'chadi.
    navigator.serviceWorker.register(`./sw.js?v=${__BUILD__}`).catch(() => undefined);
  });
  // Yangi service worker boshqaruvni olganda sahifani bir marta yangilaymiz.
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });
}

// Yangi versiya chiqdimi? Ochilganda, ekranga qaytganda va har 5 daqiqada tekshiriladi.
if (import.meta.env.PROD) {
  let checking = false;
  const check = async () => {
    if (checking || document.visibilityState !== 'visible') return;
    checking = true;
    try {
      const r = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
      const v = (await r.json()) as { build?: string };
      if (v.build && v.build !== __BUILD__) {
        // Dars yoki suhbat o'rtasida bo'lmasa — darhol yangilaymiz.
        const busy = document.querySelector('.call, .session');
        if (!busy) {
          const reg = await navigator.serviceWorker?.getRegistration();
          await reg?.update().catch(() => undefined);
          location.reload();
        }
      }
    } catch {
      /* internet yo'q — keyinroq */
    } finally {
      checking = false;
    }
  };
  window.addEventListener('load', () => setTimeout(check, 1500));
  document.addEventListener('visibilitychange', check);
  setInterval(check, 5 * 60_000);
}
