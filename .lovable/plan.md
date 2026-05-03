Vedo il problema: c'è già un controllo versione, ma oggi lavora solo in produzione e solo dopo l'avvio del bundle. In preview/dev e durante navigazioni interne può quindi restare in memoria una build vecchia finché non si ricarica manualmente. Inoltre la pulizia cache/SW è una tantum (`sw_cleaned`) e non viene ripetuta a ogni nuova versione.

Piano di intervento:

1. Rendere il bootstrap più robusto prima del render
   - Estrarre una funzione centralizzata di “cache hygiene” che:
     - elimina eventuali Service Worker residui;
     - svuota le Cache API residue;
     - salva la versione pulita, non solo un flag generico.
   - Se trova e rimuove un vecchio SW/cache, forza un reload con cache-busting prima di mostrare l’app, così l’utente non vede prima la schermata vecchia.

2. Migliorare il version check anche in preview
   - Rendere `/version.json` controllabile anche in ambiente Lovable preview, non solo produzione, evitando loop.
   - Usare un confronto sicuro tra versione bundle e versione server, con anti-loop per singola versione.
   - In caso di mismatch, mostrare una schermata minimale “Aggiornamento in corso…” invece di far apparire per qualche secondo la UI vecchia.

3. Collegare il controllo alle navigazioni interne
   - Aggiungere un watcher React collegato al cambio route (`location.pathname/search`) che controlla la versione prima/durante la navigazione.
   - Così quando clicchi una voce del menu o apri una nuova pagina, l’app verifica subito se esiste una versione nuova prima di visualizzare configurazioni obsolete.

4. Rendere i reload davvero cache-busting
   - Usare un parametro dedicato tipo `?app_v=<timestamp>` evitando accumuli disordinati.
   - Preferire `window.location.replace(...)` per non sporcare la cronologia.
   - Pulire eventuali parametri di cache-busting vecchi dopo l’avvio corretto, se necessario.

5. Aggiungere una piccola protezione UI globale
   - Durante il check iniziale, invece di renderizzare subito l’app, visualizzare un loader coerente CBnet.
   - Se serve aggiornare, l’utente vede solo il loader e poi la schermata corretta.

File previsti:
- `src/lib/versionCheck.ts`: refactor controllo versione/cache-busting.
- `src/main.tsx`: bootstrap con pulizia cache/versione prima del render.
- nuovo piccolo componente/hook tipo `AppVersionGuard` oppure modifica in `App.tsx` per controllo su cambio route.
- eventuale aggiornamento `public/version.json` solo come conseguenza del build/version plugin esistente.

Risultato atteso:
- niente più “prima vedo la vecchia schermata, poi dopo reload quella corretta”;
- alla prima apertura/navigazione viene caricata direttamente la versione aggiornata;
- eventuali residui PWA/service worker/cache vengono rimossi in modo persistente per versione.