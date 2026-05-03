import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Best-effort: rimuovi service worker e cache residue da build precedenti,
// senza bloccare il render né forzare reload.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((regs) => regs.forEach((r) => r.unregister()))
    .catch(() => {});
  if (typeof caches !== "undefined") {
    caches.keys().then((names) => names.forEach((n) => caches.delete(n))).catch(() => {});
  }
}

createRoot(document.getElementById("root")!).render(<App />);
