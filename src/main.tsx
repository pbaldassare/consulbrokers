import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { checkAppVersion, startVersionPolling } from "./lib/versionCheck";

/**
 * Boot sequence:
 * 1) Cleanup eventuali Service Worker fantasma (sincrono, prima del render)
 * 2) Check versione contro /version.json — se obsoleta → hard reload
 * 3) Render React + avvio polling versione
 */
async function boot() {
  // 1. Cleanup SW + Cache API residui (prima del render)
  if ("serviceWorker" in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (regs.length > 0) {
        await Promise.all(regs.map((r) => r.unregister()));
        // Anti-loop: ricarica una sola volta dopo aver rimosso SW vecchi
        if (!sessionStorage.getItem("sw_cleaned")) {
          sessionStorage.setItem("sw_cleaned", "1");
          window.location.reload();
          return;
        }
      }
    } catch {
      /* noop */
    }
    try {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    } catch {
      /* noop */
    }
  }

  // 2. Version check al boot (solo PROD) — se obsoleto fa hard reload
  if (import.meta.env.PROD) {
    const willReload = await checkAppVersion();
    if (willReload) return;
  }

  // 3. Render React + avvio polling (no-op in dev)
  createRoot(document.getElementById("root")!).render(<App />);
  startVersionPolling(60_000);
}

void boot();
