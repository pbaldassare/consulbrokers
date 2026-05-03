import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { checkAppVersion, startVersionPolling } from "./lib/versionCheck";

/**
 * Boot sequence:
 * 1) Cleanup eventuali Service Worker fantasma + Cache API residue
 * 2) Version check contro /version.json — se mismatch → hard reload PRIMA del render
 *    (evita di mostrare la UI vecchia per qualche secondo)
 * 3) Render React + avvio polling versione
 */

function showBootLoader() {
  const root = document.getElementById("root");
  if (!root || root.childElementCount > 0) return;
  root.innerHTML = `
    <div style="
      position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
      background:linear-gradient(135deg,hsl(199 58% 14%),hsl(199 50% 24%),hsl(170 55% 32%));
      color:#fff;font-family:system-ui,-apple-system,sans-serif;z-index:9999;
    ">
      <div style="text-align:center">
        <div style="
          width:42px;height:42px;border:3px solid rgba(255,255,255,.25);
          border-top-color:#fff;border-radius:50%;
          animation:cbnet-spin .9s linear infinite;margin:0 auto 16px;
        "></div>
        <div style="font-size:14px;letter-spacing:.18em;text-transform:uppercase;opacity:.85">
          CBnet — Caricamento
        </div>
      </div>
      <style>@keyframes cbnet-spin{to{transform:rotate(360deg)}}</style>
    </div>
  `;
}

async function cleanupServiceWorkersAndCaches(): Promise<boolean> {
  let didCleanup = false;
  if ("serviceWorker" in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (regs.length > 0) {
        await Promise.all(regs.map((r) => r.unregister()));
        didCleanup = true;
      }
    } catch {
      /* noop */
    }
    try {
      const names = await caches.keys();
      if (names.length > 0) {
        await Promise.all(names.map((n) => caches.delete(n)));
        didCleanup = true;
      }
    } catch {
      /* noop */
    }
  }
  return didCleanup;
}

async function boot() {
  showBootLoader();

  // 1. Cleanup SW + Cache API residue — se ne troviamo, ricarichiamo una volta
  //    per essere sicuri di partire pulitissimi.
  const cleaned = await cleanupServiceWorkersAndCaches();
  if (cleaned && !sessionStorage.getItem("sw_cleaned_v2")) {
    sessionStorage.setItem("sw_cleaned_v2", "1");
    window.location.reload();
    return;
  }

  // 2. Version check al boot (anche in preview) — se obsoleto fa hard reload
  //    PRIMA che React renderizzi la UI vecchia.
  const willReload = await checkAppVersion();
  if (willReload) return;

  // 3. Render React + avvio polling
  createRoot(document.getElementById("root")!).render(<App />);
  startVersionPolling(60_000);
}

void boot();
