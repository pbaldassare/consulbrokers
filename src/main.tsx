import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { BUNDLE_VERSION, ensureLatestVersion } from "./lib/versionCheck";

console.info(`[CBnet] bundle version: ${BUNDLE_VERSION}`);

// Bootstrap: monta subito la UI per evitare flicker, e in parallelo
// verifica se il bundle è allineato a /version.json. Se è vecchio,
// ensureLatestVersion pulisce le cache e ricarica (con throttle).
createRoot(document.getElementById("root")!).render(<App />);

// Check versione non bloccante
ensureLatestVersion().catch(() => {});
