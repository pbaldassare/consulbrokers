import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Build-time version stamp — changes on every deploy
const APP_VERSION = __APP_VERSION__;

// Force reload when a new version is deployed
const prevVersion = localStorage.getItem("app_version");
if (prevVersion && prevVersion !== APP_VERSION) {
  localStorage.setItem("app_version", APP_VERSION);
  location.reload();
} else {
  localStorage.setItem("app_version", APP_VERSION);
}

// Cleanup any stale service workers and caches from previous PWA config
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(r => r.unregister());
  });
  caches.keys().then(names => {
    names.forEach(name => caches.delete(name));
  });
}

createRoot(document.getElementById("root")!).render(<App />);
