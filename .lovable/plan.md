Hai ragione, il blocker "Aggiorna ora" è solo rumore. Tolgo tutto il sistema di version check / hard reload e lascio che la pagina venga sempre renderizzata normalmente.

Modifiche:

1. `src/lib/versionCheck.ts` → ridotto a no-op: `checkAppVersion()` ritorna sempre `"ok"`, `startVersionPolling()` non fa nulla. Niente più fetch a `/version.json`, niente più reload, niente più blocker.

2. `src/main.tsx` → boot semplificato: nessuna pulizia service worker, nessun loader, nessun version check. Solo `createRoot(...).render(<App />)`.

3. `src/components/AppVersionGuard.tsx` → ridotto a componente che ritorna `null`. Resta importato in `App.tsx` ma non fa più nulla, così non devo toccare il routing.

4. `public/version.json` → lasciato presente (innocuo) ma non più consultato.

Risultato atteso: niente più schermata "Aggiornamento disponibile", la rotta `/portafoglio/estrazioni-stampe` mostra subito le card aggiornate (incluse "E/C Agenzie" e "Storico E/C Agenzie") e tutte le pagine sono navigabili senza interruzioni.