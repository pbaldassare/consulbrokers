import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { BUNDLE_VERSION, purgeClientCaches } from "./lib/versionCheck";

// Diagnostica versione in console
console.info(`[CBnet] bundle version: ${BUNDLE_VERSION}`);

// Best-effort: rimuovi service worker e cache residue da build precedenti.
// Non blocca il render. La sessione Supabase (chiavi sb-*) è preservata.
purgeClientCaches().catch(() => {});

createRoot(document.getElementById("root")!).render(<App />);
