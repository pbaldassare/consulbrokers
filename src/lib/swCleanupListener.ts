/**
 * Ascolta i messaggi `CBNET_SW_NAV` inviati dal service worker kill-switch
 * (`public/sw.js`, `public/service-worker.js`). Invece di lasciare che il SW
 * navighi via i tab in modo opaco, il client decide quando ricaricare:
 *
 *  - Se è in corso una compilazione (`window.__lovableFormDirty === true`,
 *    settato ad es. da ImmissionePolizzaPage), differisce il reload e
 *    ripolla finché il form non è più sporco.
 *  - Altrimenti ricarica subito.
 *
 * Questo evita il classico "la pagina si è rifreshata mentre stavo
 * digitando" che faceva perdere quietanze, premi e altre voci in corso.
 */
export function installSwCleanupListener(): void {
  if (typeof window === "undefined") return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if ((window as any).__cbnetSwCleanupInstalled) return;
  (window as any).__cbnetSwCleanupInstalled = true;

  const handle = (data: any) => {
    if (!data || data.type !== "CBNET_SW_NAV" || typeof data.url !== "string") return;
    const targetUrl: string = data.url;
    const go = () => {
      try {
        window.location.replace(targetUrl);
      } catch {
        window.location.href = targetUrl;
      }
    };
    const isDirty = () => (window as any).__lovableFormDirty === true;
    if (!isDirty()) {
      go();
      return;
    }
    // Form aperto: aspetta che torni "pulito" (max 30 minuti, poi rinuncia
    // silenziosamente — l'utente farà reload manuale all'occorrenza).
    const started = Date.now();
    const MAX_WAIT_MS = 30 * 60 * 1000;
    const id = window.setInterval(() => {
      if (!isDirty()) {
        window.clearInterval(id);
        go();
        return;
      }
      if (Date.now() - started > MAX_WAIT_MS) {
        window.clearInterval(id);
      }
    }, 1000);
  };

  try {
    navigator.serviceWorker.addEventListener("message", (e: MessageEvent) => handle(e?.data));
  } catch {
    // no-op
  }
}
