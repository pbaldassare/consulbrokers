/**
 * Version check + cache purge utilities.
 *
 * Confronta la versione del bundle (VITE_APP_VERSION embedded a build-time)
 * con quella servita da /version.json. Se non coincidono, l'utente sta
 * eseguendo un bundle vecchio: registriamo un kill-switch SW, puliamo cache
 * e ricarichiamo (con throttle anti-loop).
 */

const VERSION_STORAGE_PREFIX = "__cbnet_version_";
const RELOAD_FLAG = `${VERSION_STORAGE_PREFIX}reload_ts`;
const RELOAD_SERVER_KEY = `${VERSION_STORAGE_PREFIX}reload_server`;
const RELOAD_THROTTLE_MS = 30_000;
const RELOAD_COOLDOWN_MS = 5 * 60_000;
const STORAGE_KEYS_TO_KEEP = (k: string) =>
  k.startsWith("sb-") || k.startsWith("supabase.") || k.startsWith(VERSION_STORAGE_PREFIX);

export const BUNDLE_VERSION: string =
  (import.meta as any).env?.VITE_APP_VERSION || "dev";

// Disattiviamo il check SOLO su localhost (vero dev locale).
// In tutte le altre situazioni (preview Lovable, custom domain, prod)
// il bundle è statico e va riallineato al server.
const IS_LOCAL_DEV =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");
let versionCheckPromise: Promise<boolean> | null = null;


export interface VersionInfo {
  bundle: string;
  server: string | null;
  match: boolean;
}

export async function fetchServerVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?ts=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

export async function getVersionInfo(): Promise<VersionInfo> {
  const server = await fetchServerVersion();
  return {
    bundle: BUNDLE_VERSION,
    server,
    match: !server || server === BUNDLE_VERSION,
  };
}

/**
 * Disinstalla service worker registrati e cancella tutte le cache.
 * Se possibile, registra prima il kill-switch /sw.js per intercettare
 * eventuali registrazioni residue.
 */
export async function purgeClientCaches(): Promise<void> {
  // 1. Service workers — unregister tutto
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
    }
  } catch {}

  // 2. Cache Storage
  try {
    if (typeof caches !== "undefined") {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n).catch(() => false)));
    }
  } catch {}

  // 3. Storage tecnico (preserva sessione Supabase)
  try {
    const removeFrom = (s: Storage) => {
      const toRemove: string[] = [];
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (k && !STORAGE_KEYS_TO_KEEP(k)) toRemove.push(k);
      }
      toRemove.forEach((k) => s.removeItem(k));
    };
    removeFrom(localStorage);
    removeFrom(sessionStorage);
  } catch {}
}

function readVersionStorage(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeVersionStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
    sessionStorage.setItem(key, value);
  } catch {}
}

function recentlyReloadedFor(serverVersion: string | null): boolean {
  if (!serverVersion) return false;
  const last = Number(readVersionStorage(RELOAD_FLAG) || 0);
  const lastServer = readVersionStorage(RELOAD_SERVER_KEY);
  return lastServer === serverVersion && Date.now() - last < RELOAD_COOLDOWN_MS;
}

export function forceReload(reason: string, serverVersion?: string | null): boolean {
  try {
    const last = Number(readVersionStorage(RELOAD_FLAG) || 0);
    const now = Date.now();
    if (now - last < RELOAD_THROTTLE_MS) {
      console.warn(`[versionCheck] reload skipped (throttle): ${reason}`);
      return false;
    }
    writeVersionStorage(RELOAD_FLAG, String(now));
    if (serverVersion) writeVersionStorage(RELOAD_SERVER_KEY, serverVersion);
  } catch {}

  const url = new URL(window.location.href);
  url.searchParams.set("__v", Date.now().toString());
  console.warn(`[versionCheck] forcing reload: ${reason}`);
  window.location.replace(url.toString());
  return true;
}

/**
 * Esegue il check, pulisce caches e ricarica se la versione è disallineata.
 * Ritorna true se la versione è OK (l'app può proseguire).
 */
async function runLatestVersionCheck(): Promise<boolean> {
  if (IS_LOCAL_DEV) {
    // In preview/dev Vite aggiorna i moduli via HMR. Forzare reload su version.json
    // può creare loop quando il dev server mantiene lo stesso VITE_APP_VERSION.
    return true;
  }

  const info = await getVersionInfo();
  console.info(
    `[versionCheck] bundle=${info.bundle} server=${info.server ?? "n/a"} match=${info.match}`,
  );
  if (info.match) return true;

  if (recentlyReloadedFor(info.server)) {
    console.warn(
      `[versionCheck] reload skipped (cooldown): bundle ${info.bundle} != server ${info.server}`,
    );
    return true;
  }

  await purgeClientCaches();
  return !forceReload(`bundle ${info.bundle} != server ${info.server}`, info.server);
}

export async function ensureLatestVersion(): Promise<boolean> {
  if (versionCheckPromise) return versionCheckPromise;
  versionCheckPromise = runLatestVersionCheck().finally(() => {
    versionCheckPromise = null;
  });
  return versionCheckPromise;
}
