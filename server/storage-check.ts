// Doimiy disk tekshiruvi: Railway'da volume ulanmagan bo'lsa SQLite fayli (akkauntlar, progress, AI rozilik
// va kunlik quota hisoblagichlari) har redeploy'da yo'qoladi. Bu yerda faqat nomlar qaytadi, qiymatlar emas.
import { resolve, sep } from 'node:path';

export type StorageWarning = 'railway_volume_missing' | 'db_outside_railway_volume' | 'db_in_memory';

function dbFile(env: NodeJS.ProcessEnv): string {
  return env.SALUT_DB ?? resolve(env.SALUT_DATA_DIR ?? 'data', 'salut.db');
}

function onRailway(env: NodeJS.ProcessEnv): boolean {
  return Boolean(env.RAILWAY_ENVIRONMENT_NAME || env.RAILWAY_ENVIRONMENT || env.RAILWAY_PROJECT_ID || env.RAILWAY_SERVICE_ID);
}

/** Bo'sh ro'yxat — muammo topilmadi. Railway'dan tashqarida faqat ':memory:' baza ogohlantiriladi. */
export function storageWarnings(env: NodeJS.ProcessEnv): StorageWarning[] {
  const file = dbFile(env);
  if (file === ':memory:') return env.NODE_ENV === 'production' ? ['db_in_memory'] : [];
  if (!onRailway(env)) return [];
  const mount = env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
  if (!mount) return ['railway_volume_missing'];
  const root = resolve(mount);
  const abs = resolve(file);
  return abs === root || abs.startsWith(root.endsWith(sep) ? root : root + sep) ? [] : ['db_outside_railway_volume'];
}

export const STORAGE_WARNING_TEXT: Record<StorageWarning, string> = {
  railway_volume_missing: "Railway'da volume ulanmagan: baza har redeploy'da o'chadi. Servisga /data ga volume ulang.",
  db_outside_railway_volume: "Baza fayli Railway volume ichida emas: SALUT_DATA_DIR ni volume yo'liga moslang.",
  db_in_memory: "Production'da baza xotirada (':memory:'): restartda hammasi o'chadi.",
};
