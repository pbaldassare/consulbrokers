import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import {
  BUNDLE_VERSION,
  ensureLatestVersion,
  purgeClientCaches,
} from "./lib/versionCheck";

console.info(`[CBnet] bundle version: ${BUNDLE_VERSION}`);

// Bootstrap: pulisce SW/cache residui PRIMA di montare la UI, poi verifica
// la versione. Se il bundle è vecchio, ensureLatestVersion ricarica
// la pagina e l'app non monta affatto la UI vecchia.
async function bootstrap() {
  try {
    await purgeClientCaches();
  } catch {}

  let versionOk = true;
  try {
    versionOk = await ensureLatestVersion();
  } catch {
    versionOk = true; // non bloccare se il check fallisce
  }

  if (!versionOk) {
    // reload imminente: non montare nulla
    return;
  }

  createRoot(document.getElementById("root")!).render(<App />);
}

bootstrap();
