## Causa probabile

Il refresh non è scatenato dalla virgola. È il **service-worker kill-switch** in `public/sw.js` e `public/service-worker.js`: al suo `activate` (che ri-scatta anche dopo aver scaricato una nuova versione del bundle, o quando il browser ricontrolla il SW) esegue `client.navigate(url + ?sw-cleanup=…&__v=…)` su **tutti** i client. Questo è di fatto un reload e **bypassa** il guard `__lovableFormDirty` che già protegge `AppVersionGuard.forceReload`. Il flag in `ImmissionePolizzaPage` viene settato correttamente, ma il SW non lo legge.

In più, il salvataggio in bozza dell'input Premio Lordo della riga avviene solo **on blur** (perché il valore digitato sta in `lordoDrafts` locale alla shell): finché l'utente sta digitando "476," il valore non è ancora in `premiFirmaRows`, quindi `useDraftPersistence` non lo serializza. Risultato: se il SW naviga via mentre stai digitando, perdi proprio quel campo (e tutto sembra "rifreshato dopo la virgola").

## Modifica 1 — Service worker: chiedere il consenso al client invece di navigare

File: `public/sw.js` e `public/service-worker.js`.

- Sostituire `client.navigate(...)` con `client.postMessage({ type: "CBNET_SW_NAV", url })`.
- Continuare a fare `caches.delete(...)` e `self.registration.unregister()` come ora.

Aggiungere un piccolo listener lato app (nuovo `src/lib/swCleanupListener.ts`, importato da `App.tsx`):

```ts
navigator.serviceWorker?.addEventListener("message", (e) => {
  if (e?.data?.type !== "CBNET_SW_NAV") return;
  const go = () => window.location.replace(e.data.url);
  if ((window as any).__lovableFormDirty === true) {
    // riprova quando il form non è più sporco
    const id = window.setInterval(() => {
      if ((window as any).__lovableFormDirty !== true) {
        window.clearInterval(id);
        go();
      }
    }, 1000);
  } else {
    go();
  }
});
```

Effetto: con la pagina Immissione aperta il SW non porta via il tab finché l'utente è in compilazione.

## Modifica 2 — Persistere subito il draft del Lordo riga

File: `src/components/polizze/PremiGaranziaCardShell.tsx`, input "Premio Lordo" della riga (linee 437‑456).

- Aggiungere prop opzionale `onRowDraftChange?: (idx: number, draft: { lordo?: string }) => void`.
- Nell'`onChange` del lordo, oltre a `setLordoDrafts`, chiamare `onRowDraftChange?.(idx, { lordo: e.target.value })`.
- In `ImmissionePolizzaPage.tsx` aggiungere `lordoDraftsFirma` / `lordoDraftsQuietanza` a `draftSnapshot`, così la bozza salva anche le stringhe in corso di digitazione e, al ripristino, le rimette in `lordoDrafts` via prop `initialLordoDrafts`.

Effetto: anche in caso di reload accidentale, la stringa "476," (e le altre digitazioni parziali) viene ripristinata.

## Modifica 3 — Robustezza piccola in `canReloadNow`

File: `src/lib/versionCheck.ts`. Già copre il caso `__lovableFormDirty` e focus su INPUT; nessuna modifica funzionale richiesta. Solo verifica che `App.tsx` monti sempre `AppVersionGuard` (già fatto) e che il flag dirty resti `true` finché l'utente è sulla pagina Immissione (già fatto in `ImmissionePolizzaPage`, lines 618‑621).

## Verifica

1. Aprire `/portafoglio/immissione`, iniziare a compilare, lasciare la pagina aperta mentre viene rilasciato un nuovo bundle (oppure forzare manualmente un messaggio `CBNET_SW_CLEANUP` dal DevTools): la pagina non deve navigare via finché c'è il form aperto.
2. Digitare "340," nel Lordo della riga, ricaricare manualmente la pagina: alla riapertura, il valore "340," deve essere ripristinato dal draft.

## Cosa NON viene toccato

- Logica di back-solve `handleLordoChange` e arrotondamenti (già corretti in passaggio precedente).
- Comportamento di `AppVersionGuard` per gli altri form (continua a funzionare via `__lovableFormDirty`).
- Le funzioni di `versionCheck.ts`.
