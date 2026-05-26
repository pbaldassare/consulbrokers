## Diagnosi

Ho controllato `src/components/AppSidebar.tsx`, `src/routes/*` e tutto `src/`. Nel codice **NON esistono più** le voci legacy:

- ❌ `FATTURAPA` — assente in sidebar
- ❌ `CONT. GENERALE` — assente in sidebar
- ❌ `FORNITORI` — assente in sidebar  
- ❌ `BANCA IMPORT` — assente in sidebar

Le rotte `/fatturapa/*`, `/contabilita-generale/*`, `/fornitori/*`, `/banca-import/*` sono già redirect → `/contabilita` in `src/routes/contabilita.tsx`.

La sidebar attuale ha: Home, Assistente IA, Area CFO, Trattative, Bandi Pubblici, Chat, Portafoglio, Archivio Documentale, Anagrafiche Utenti, Sinistri, Contabilità, Sistema, Provvigioni, Notifiche.

**Lo screenshot mostra però la VECCHIA sidebar** con FATTURAPA + CONT. GENERALE + Comunicazioni + ARCHIVI come gruppo separato. Questo significa che il tuo browser sta caricando un **bundle JS vecchio in cache** (HTTP cache + eventuale Service Worker residuo). Il sistema di version-check esiste (`AppVersionGuard` + `versionCheck.ts`), ma:

1. In **dev/preview** (`IS_DEV=true`) è disattivato → la preview Lovable non forza il reload.
2. Anche in produzione, se l'`index.html` viene servito dalla cache del browser con `VITE_APP_VERSION` vecchio, il check confronta vecchio↔vecchio e non scatta.
3. Il kill-switch SW (`/sw.js`) funziona solo se l'utente ha un SW registrato; se il browser ha solo cache HTTP del bundle, non basta.

## Cosa farò

### 1. `index.html` — disabilitare cache HTML
Aggiungo meta cache-control per impedire al browser di servire un `index.html` vecchio:
```html
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
<meta http-equiv="Pragma" content="no-cache" />
<meta http-equiv="Expires" content="0" />
```
Così ad ogni apertura il browser richiede sempre l'HTML fresco; gli asset JS hashati di Vite poi si caricano automaticamente nuovi.

### 2. `versionCheck.ts` — attivare check anche in preview
Rimuovo il bypass `IS_DEV` per il path `id-preview--*.lovable.app` e `*.lovable.app`: in quegli ambienti il bundle è statico (non HMR), quindi il check ha senso. Resta disattivato SOLO quando hostname è `localhost`.

### 3. Boot one-shot purge
Al primo mount di `AppVersionGuard`, eseguo **una volta** `purgeClientCaches()` se in `localStorage` non c'è il flag `__cbnet_purged_2026_05_26`. Questo garantisce che ogni utente con bundle stantio venga "ripulito" alla prossima apertura, poi non più.

### 4. Registrazione kill-switch SW garantita
In `main.tsx` aggiungo (se non c'è già) la registrazione di `/sw.js` all'avvio, che disinstalla qualunque vecchio SW e cancella `caches`. Idempotente.

### 5. Bump versione `manifest.json` query param
Cambio `manifest.json?v=2` → `?v=3` in `index.html` per forzare refetch del manifest PWA.

## File toccati

- `index.html` (meta cache + bump manifest)
- `src/lib/versionCheck.ts` (logica IS_DEV ristretta a localhost)
- `src/components/AppVersionGuard.tsx` (purge one-shot al boot)
- `src/main.tsx` (registrazione `/sw.js` kill-switch)

## Cosa NON farò

- Non tocco `AppSidebar.tsx` (è già corretto)
- Non tocco la business logic
- Non rimuovo `/sw.js` (serve come kill-switch per chi ha vecchi SW)

## Effetto atteso

Alla prossima apertura: il browser scarica `index.html` fresco (no-cache), `AppVersionGuard` esegue la purge one-shot, eventuali SW vecchi vengono unregistered, le cache vengono svuotate, e vedi subito la sidebar corretta senza FATTURAPA/CONT. GENERALE.
