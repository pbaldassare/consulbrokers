/**
 * Version check: confronta la VITE_APP_VERSION embedded nel bundle JS
 * con il file /version.json servito statico (rigenerato a ogni build).
 * Se differiscono → forza un hard reload con cache busting.
 */

const BUNDLE_VERSION = import.meta.env.VITE_APP_VERSION || "dev";

/**
 * Esegue il reload "hard" aggiungendo un parametro _v alla URL,
 * così il browser bypassa cache HTTP/SW e scarica index.html nuovo.
 * Usa sessionStorage come anti-loop: max 1 reload per versione server.
 */
function hardReload(serverVersion: string) {
  const flag = `reloaded_for_${serverVersion}`;
  if (sessionStorage.getItem(flag)) {
    console.warn("[VersionCheck] reload già eseguito per", serverVersion, "— skip per evitare loop");
    return;
  }
  sessionStorage.setItem(flag, "1");
  const url = new URL(window.location.href);
  url.searchParams.set("_v", Date.now().toString());
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
    if (serverVersion !== BUNDLE_VERSION) {
      console.info(
        `[VersionCheck] bundle=${BUNDLE_VERSION} server=${serverVersion} → hard reload`
      );
      hardReload(serverVersion);
      return true;
    }
    return false;
  } catch (err) {
    // Network/fetch error: non bloccare l'app
    console.warn("[VersionCheck] check fallito:", err);
    return false;
  }
}

/**
 * Avvia il polling periodico (60s) + check su visibility/focus.
 * Da chiamare una volta al boot dell'app.
 */
export function startVersionPolling(intervalMs = 60_000) {
  if (BUNDLE_VERSION === "dev") return;

  // Polling periodico
  setInterval(() => {
    void checkAppVersion();
  }, intervalMs);

  // Check quando la tab torna visibile
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void checkAppVersion();
    }
  });

  // Check su focus finestra
  window.addEventListener("focus", () => {
    void checkAppVersion();
  });
}
