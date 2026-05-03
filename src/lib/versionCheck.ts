/**
 * Version check: confronta la VITE_APP_VERSION embedded nel bundle JS
 * con il file /version.json servito statico. Se differiscono → hard reload
 * con cache busting. Se dopo N tentativi la versione resta diversa,
 * mostra una schermata di aggiornamento invece di lasciare la UI vecchia.
 */

const BUNDLE_VERSION = (import.meta.env.VITE_APP_VERSION as string) || "dev";
const ATTEMPTS_KEY = "vc_attempts";
const ATTEMPTS_VERSION_KEY = "vc_attempts_version";
const MAX_ATTEMPTS = 2;

function getAttempts(serverVersion: string): number {
  try {
    const v = sessionStorage.getItem(ATTEMPTS_VERSION_KEY);
    if (v !== serverVersion) return 0;
    return Number(sessionStorage.getItem(ATTEMPTS_KEY) || "0") || 0;
  } catch { return 0; }
}
function setAttempts(serverVersion: string, n: number) {
  try {
    sessionStorage.setItem(ATTEMPTS_VERSION_KEY, serverVersion);
    sessionStorage.setItem(ATTEMPTS_KEY, String(n));
  } catch { /* noop */ }
}
function clearAttempts() {
  try {
    sessionStorage.removeItem(ATTEMPTS_KEY);
    sessionStorage.removeItem(ATTEMPTS_VERSION_KEY);
    // pulizia legacy
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith("reloaded_for_")) sessionStorage.removeItem(k);
    }
  } catch { /* noop */ }
}

function showUpdateBlocker(serverVersion: string) {
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = `
    <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
      background:linear-gradient(135deg,hsl(199 58% 14%),hsl(199 50% 24%),hsl(170 55% 32%));
      color:#fff;font-family:system-ui,-apple-system,sans-serif;z-index:9999;padding:24px;text-align:center">
      <div style="max-width:480px">
        <div style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;opacity:.7;margin-bottom:8px">CBnet</div>
        <h1 style="font-size:22px;margin:0 0 12px">Aggiornamento disponibile</h1>
        <p style="opacity:.85;line-height:1.5;margin:0 0 20px">
          È stata rilevata una nuova versione (${serverVersion}). Per evitare di mostrare configurazioni obsolete
          aggiorna la pagina ora.
        </p>
        <button id="vc-reload-btn" style="
          background:#fff;color:#0f3a3a;border:0;border-radius:8px;
          padding:10px 18px;font-weight:600;cursor:pointer;font-size:14px">
          Aggiorna ora
        </button>
      </div>
    </div>
  `;
  const btn = document.getElementById("vc-reload-btn");
  btn?.addEventListener("click", () => {
    clearAttempts();
    const url = new URL(window.location.href);
    url.searchParams.set("app_v", `${serverVersion}-${Date.now()}`);
    window.location.replace(url.toString());
  });
}

function hardReload(serverVersion: string) {
  const url = new URL(window.location.href);
  url.searchParams.delete("_v");
  url.searchParams.set("app_v", `${serverVersion}-${Date.now()}`);
  window.location.replace(url.toString());
}

/**
 * Verifica versione. Ritorna:
 *  - "reload"  → ho avviato un hard reload, non renderizzare React
 *  - "block"   → mismatch persistente, ho mostrato la schermata di update
 *  - "ok"      → versioni allineate (oppure dev), procedi con render
 */
export async function checkAppVersion(): Promise<"reload" | "block" | "ok"> {
  if (BUNDLE_VERSION === "dev") return "ok";
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (!res.ok) return "ok";
    const data = (await res.json()) as { version?: string };
    const serverVersion = data?.version;
    if (!serverVersion) return "ok";

    if (serverVersion === BUNDLE_VERSION) {
      // versioni allineate → pulizia tentativi e param vecchi
      clearAttempts();
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has("app_v")) {
          url.searchParams.delete("app_v");
          window.history.replaceState({}, "", url.toString());
        }
      } catch { /* noop */ }
      return "ok";
    }

    const attempts = getAttempts(serverVersion);
    if (attempts >= MAX_ATTEMPTS) {
      console.warn(`[VersionCheck] mismatch persistente bundle=${BUNDLE_VERSION} server=${serverVersion} → blocker`);
      showUpdateBlocker(serverVersion);
      return "block";
    }
    setAttempts(serverVersion, attempts + 1);
    console.info(`[VersionCheck] bundle=${BUNDLE_VERSION} server=${serverVersion} → reload (tent. ${attempts + 1}/${MAX_ATTEMPTS})`);
    hardReload(serverVersion);
    return "reload";
  } catch (err) {
    console.warn("[VersionCheck] check fallito:", err);
    return "ok";
  }
}

export function startVersionPolling(intervalMs = 60_000) {
  if (BUNDLE_VERSION === "dev") return;
  setInterval(() => { void checkAppVersion(); }, intervalMs);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkAppVersion();
  });
  window.addEventListener("focus", () => { void checkAppVersion(); });
}
