import { useEffect } from "react";
import { ensureLatestVersion, BUNDLE_VERSION } from "@/lib/versionCheck";

/**
 * AppVersionGuard
 *
 * - All'avvio: confronta bundle vs /version.json. Se diverso, pulisce caches e reload.
 * - Polling rapido (ogni 30s) così la preview si auto-aggiorna dopo una modifica.
 * - Re-check immediato quando il tab torna visibile o riceve focus.
 * - Re-check quando torna online dopo disconnessione.
 *
 * Throttle anti-loop di reload è gestito in versionCheck.ts (30s).
 */
const POLL_MS = 30_000;

const AppVersionGuard = () => {
  useEffect(() => {
    console.info(`[AppVersionGuard] bundle ${BUNDLE_VERSION}`);

    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      ensureLatestVersion().catch(() => {});
    };

    const t0 = window.setTimeout(run, 800);
    const interval = window.setInterval(run, POLL_MS);

    const onVis = () => {
      if (document.visibilityState === "visible") run();
    };
    const onFocus = () => run();
    const onOnline = () => run();

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    return () => {
      cancelled = true;
      window.clearTimeout(t0);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return null;
};

export default AppVersionGuard;
