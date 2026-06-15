## Problema

Ogni tanto la pagina si auto-ricarica e l'utente perde il contesto (form aperti, scroll, ecc.). Le cause attuali nel codice sono **tre meccanismi sovrapposti** che fanno reload "da soli":

1. **`AppVersionGuard` + `versionCheck.ts`** — polling ogni 30s di `/version.json`; se il bundle non combacia, pulisce cache e chiama `forceReload()` automaticamente (anche senza click utente). Basta un deploy o un `version.json` rigenerato per far partire il reload.
2. **Service worker kill-switch** (`public/sw.js` + `public/service-worker.js`) — ad ogni attivazione manda `CBNET_SW_NAV` ai client, e `swCleanupListener.ts` esegue `window.location.replace(...)` se il form non è "dirty". È pensato per disinstallarsi, ma viene re-registrato e continua a sparare reload.
3. **`useInactivityTimeout`** — 30 min, fa `signOut` (non un reload vero ma cambia rotta a `/login`). Resta com'è, non è la causa segnalata.

Il flag `__lovableFormDirty` protegge solo alcuni form (es. ImmissionePolizza). Tutte le altre pagine (TitoloDetail in edit, Sinistri, ecc.) **non lo settano**, quindi vengono ricaricate sotto le mani dell'utente.

## Soluzione: rimuovere i reload automatici, lasciare solo banner manuale

Niente più reload "a sorpresa". L'unico modo per ricaricare diventa il bottone **"Aggiorna ora"** che l'utente già vede nel banner di `AppVersionGuard`.

### 1. `src/lib/versionCheck.ts`
- `runLatestVersionCheck()`: **non** chiamare più `purgeClientCaches()` né `forceReload()` quando la versione è stale. Limitarsi a notificare `state: "stale"` così il banner appare.
- `forceReload()` resta, ma viene invocata SOLO da `refreshToLatestVersion()` (click utente).
- Mantenere il polling 30s (serve solo a mostrare il banner), ma rimuovere il re-check su `focus`/`visibilitychange`/`online` per evitare check ridondanti (opzionale; comunque innocuo perché non ricarica più da solo).

### 2. Service worker kill-switch
- `public/sw.js` e `public/service-worker.js`: ridurli a un SW che fa **solo** `self.registration.unregister()` + `caches.delete(...)` su `install`/`activate`, senza più mandare `CBNET_SW_NAV` ai client. Nessun `postMessage`, nessun reload indotto.
- `src/lib/swCleanupListener.ts`: rendere il listener un **no-op** (mantenere la funzione esportata per non rompere l'import in `main.tsx`, ma non eseguire più `window.location.replace`).
- Effetto: i SW vecchi già installati sui browser degli utenti si disinstallano alla prossima visita e da lì in poi non c'è più nessun SW attivo a forzare navigazioni.

### 3. `AppVersionGuard`
- Nessuna modifica funzionale: continua a mostrare il banner "Versione non aggiornata" con il bottone **"Aggiorna ora"** (l'unico path che ora ricarica davvero).
- Mantenere la diagnostica SW nel banner.

### 4. Cosa NON tocco
- `useInactivityTimeout` (logout dopo 30 min) — comportamento voluto.
- `AppErrorBoundary` — non causa reload automatici.
- Logica di dominio (titoli, contabilità, ecc.) — invariata.

## Verifica

- Aprire una pagina con form (TitoloDetail in modifica, ImmissionePolizza, Sinistro wizard), aspettare > 30s, simulare un cambio `version.json`: deve comparire solo il banner in alto, **nessun reload**. Il form resta intatto. Click su "Aggiorna ora" → reload pulito.
- Controllare in DevTools → Application → Service Workers: dopo il primo caricamento post-fix non deve risultare nessun SW attivo per il dominio.
- Smoke test Playwright esistenti (`02-navigation.spec.ts`) devono restare verdi.

## File toccati

- `src/lib/versionCheck.ts` (rimuovere auto-reload nel check)
- `public/sw.js` (svuotare logica postMessage)
- `public/service-worker.js` (svuotare logica postMessage)
- `src/lib/swCleanupListener.ts` (no-op)
- `src/components/AppVersionGuard.tsx` (eventuale rimozione listener focus/visibility, opzionale)
