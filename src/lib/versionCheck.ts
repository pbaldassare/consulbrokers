/**
 * Version check: confronta la VITE_APP_VERSION embedded nel bundle JS
 * con il file /version.json servito statico (rigenerato a ogni build).
 * Se differiscono → forza un hard reload con cache busting.
 *
 * Funziona sia in produzione che in preview (Lovable proxy serve
 * /version.json con Cache-Control: no-store), con anti-loop per versione.
 */

const BUNDLE_VERSION = (import.meta.env.VITE_APP_VERSION as string) || "dev";

/**
 * Pulisce i flag anti-loop residui in sessionStorage che non corrispondono
 * più alla versione server attuale.
 */
function cleanupStaleFlags(currentServerVersion: string) {
  try {
    const keep = `reloaded_for_${currentServerVersion}`;
    const toRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith("reloaded_for_") && key !== keep) {
        toRemove.push(key);
      }
    }
    toRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* noop */
  }
}

/**
 * Hard reload con cache busting + anti-loop (max 1 reload per versione server).
 */
function hardReload(serverVersion: string) {
  const flag = `reloaded_for_${serverVersion}`;
  try {
    if (sessionStorage.getItem(flag)) {
      console.warn("[VersionCheck] reload già eseguito per", serverVersion, "— skip");
      return;
    }
    sessionStorage.setItem(flag, "1");
  } catch {
    /* noop */
  }
  const url = new URL(window.location.href);
  // pulisce eventuali param vecchi e ne mette uno solo
  url.searchParams.delete("_v");
  url.searchParams.set("app_v", serverVersion);
  window.location.replace(url.toString());
}

/**
 * Verifica se è disponibile una nuova versione lato server.
 * @returns true se è stato avviato un reload, false altrimenti.
 */
export async function checkAppVersion(): Promise<boolean> {
  if (BUNDLE_VERSION === "dev") return false;
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { version?: string };
    const serverVersion = data?.version;
    if (!serverVersion) return false;

    cleanupStaleFlags(serverVersion);

    if (serverVersion !== BUNDLE_VERSION) {
      console.info(
        `[VersionCheck] bundle=${BUNDLE_VERSION} server=${serverVersion} → hard reload`
      );
      hardReload(serverVersion);
      return true;
    }
    return false;
  } catch (err) {
    console.warn("[VersionCheck] check fallito:", err);
    return false;
  }
}

/**
 * Avvia il polling periodico (60s) + check su visibility/focus.
 */
export function startVersionPolling(intervalMs = 60_000) {
  if (BUNDLE_VERSION === "dev") return;

  setInterval(() => {
    void checkAppVersion();
  }, intervalMs);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void checkAppVersion();
    }
  });

  window.addEventListener("focus", () => {
    void checkAppVersion();
  });
}
