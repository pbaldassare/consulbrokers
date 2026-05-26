import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { BUNDLE_VERSION, purgeClientCaches } from "./lib/versionCheck";

console.info(`[CBnet] bundle version: ${BUNDLE_VERSION}`);

// One-shot cleanup: rimuove ogni SW/cache legacy che mostrava la vecchia sidebar
// (FATTURAPA, Cont. Generale, Fornitori, Banca Import). Eseguito una sola volta
// per browser; flag persistente in localStorage.
const PURGE_FLAG = "__cbnet_purged_2026_05_26";
try {
  if (typeof window !== "undefined" && !localStorage.getItem(PURGE_FLAG)) {
    purgeClientCaches()
      .catch(() => {})
      .finally(() => {
        try {
          localStorage.setItem(PURGE_FLAG, "1");
        } catch {}
      });
  }
} catch {}

// Registra il kill-switch SW: disinstalla SW residui e svuota cache.
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
