import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Build-time version stamp — changes on every deploy
const APP_VERSION = import.meta.env.VITE_APP_VERSION || "dev";

// Force reload when a new version is deployed (one-shot, anti-loop)
const prevVersion = localStorage.getItem("app_version");
if (prevVersion && prevVersion !== APP_VERSION && APP_VERSION !== "dev") {
  localStorage.setItem("app_version", APP_VERSION);
  // Prevent infinite loop: only reload once per version
  if (!sessionStorage.getItem(`refreshed_${APP_VERSION}`)) {
    sessionStorage.setItem(`refreshed_${APP_VERSION}`, "1");
    location.reload();
  }
} else {
  localStorage.setItem("app_version", APP_VERSION);
}

// Cleanup any stale service workers and caches from previous PWA config
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
  caches.keys().then((names) => {
    names.forEach((name) => caches.delete(name));
  });
}

// Re-check version when user returns to tab (catches stale background tabs)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    const stored = localStorage.getItem("app_version");
    if (stored && stored !== APP_VERSION && APP_VERSION !== "dev") {
      if (!sessionStorage.getItem(`refreshed_${stored}`)) {
        sessionStorage.setItem(`refreshed_${stored}`, "1");
        location.reload();
      }
    }
  }
});

createRoot(document.getElementById("root")!).render(<App />);
