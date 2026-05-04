/**
 * Version check + cache purge utilities.
 *
 * Confronta la versione del bundle (VITE_APP_VERSION embedded a build-time)
 * con quella servita da /version.json. Se non coincidono, l'utente sta
 * eseguendo un bundle vecchio: registriamo un kill-switch SW, puliamo cache
 * e ricarichiamo (con throttle anti-loop).
 */

const RELOAD_FLAG = "__cbnet_version_reload_ts";
const RELOAD_THROTTLE_MS = 30_000;
const STORAGE_KEYS_TO_KEEP = (k: string) =>
  k.startsWith("sb-") || k.startsWith("supabase.");

export const BUNDLE_VERSION: string =
  (import.meta as any).env?.VITE_APP_VERSION || "dev";

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

export function forceReload(reason: string): void {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_FLAG) || 0);
    const now = Date.now();
    if (now - last < RELOAD_THROTTLE_MS) {
      console.warn(`[versionCheck] reload skipped (throttle): ${reason}`);
      return;
    }
    sessionStorage.setItem(RELOAD_FLAG, String(now));
  } catch {}

  const url = new URL(window.location.href);
  url.searchParams.set("__v", Date.now().toString());
  console.warn(`[versionCheck] forcing reload: ${reason}`);
  window.location.replace(url.toString());
}

/**
 * Esegue il check, pulisce caches e ricarica se la versione è disallineata.
 * Ritorna true se la versione è OK (l'app può proseguire).
 */
export async function ensureLatestVersion(): Promise<boolean> {
  const info = await getVersionInfo();
  console.info(
    `[versionCheck] bundle=${info.bundle} server=${info.server ?? "n/a"} match=${info.match}`,
  );
  if (info.match) return true;
  await purgeClientCaches();
  forceReload(`bundle ${info.bundle} != server ${info.server}`);
  return false;
}
