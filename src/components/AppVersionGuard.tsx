import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { checkAppVersion } from "@/lib/versionCheck";

/**
 * Esegue un check versione ad ogni cambio route (con throttling 10s).
 * Se la versione del bundle in memoria è obsoleta rispetto a /version.json
 * forza un hard reload prima di mostrare la nuova schermata, così l'utente
 * non vede mai una pagina con configurazioni vecchie.
 */
const AppVersionGuard = () => {
  const location = useLocation();
  const lastCheckRef = useRef(0);

  useEffect(() => {
    const now = Date.now();
    if (now - lastCheckRef.current < 10_000) return;
    lastCheckRef.current = now;
    void checkAppVersion();
  }, [location.pathname, location.search]);

  return null;
};

export default AppVersionGuard;
