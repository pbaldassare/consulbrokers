import { useEffect } from "react";
import { ensureLatestVersion, BUNDLE_VERSION } from "@/lib/versionCheck";

/**
 * AppVersionGuard
 *
 * - All'avvio: confronta bundle vs /version.json. Se diverso, pulisce caches e reload.
 * - Periodicamente (ogni 5 min) ripete il check così tab aperti a lungo si aggiornano.
 * - Re-check quando il tab torna visibile.
 *
 * Non blocca il render: opera in background. Il reload avviene solo se necessario
 * ed è throttled da versionCheck.ts per evitare loop.
 */
const AppVersionGuard = () => {
  useEffect(() => {
    console.info(`[AppVersionGuard] bundle ${BUNDLE_VERSION}`);

    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      ensureLatestVersion().catch(() => {});
    };

    // Check iniziale (lievemente differito per non rallentare il first paint)
    const t0 = window.setTimeout(run, 1500);
    // Check periodico
    const interval = window.setInterval(run, 5 * 60 * 1000);
    // Check al ritorno del tab in foreground
    const onVis = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      window.clearTimeout(t0);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return null;
};

export default AppVersionGuard;
