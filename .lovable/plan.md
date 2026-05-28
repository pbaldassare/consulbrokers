Obiettivo: eliminare davvero le pagine legacy visibili dopo refresh e rendere il caricamento immune da cache/PWA obsolete.

1. Ripulire la sidebar
- Rimuovere dalla navigazione le voci legacy ancora presenti nello screenshot/codice: `Area CFO`, `Provvigioni Consul` e ogni altra voce non più voluta.
- Mantenere solo le sezioni attuali già previste: Home, Trattative, Portafoglio, Archivio Documentale, Anagrafiche Utenti, Sinistri, Contabilità, Sistema, Provvigioni, Notifiche.
- Aggiornare eventuali label residue nella sitemap per non far riapparire nomi vecchi tramite ricerca interna o pagine elenco.

2. Blindare le vecchie route
- Le route legacy già redirette (`/contabilita-generale`, `/fatturapa`, `/fornitori`, `/banca-import`) resteranno redirette.
- Aggiungere/normalizzare redirect anche per route legacy ancora raggiungibili dalla sidebar, ad esempio `/area-cfo` e `/provvigioni-sede`, verso pagine attuali coerenti.
- Non cancellare dati o tabelle DB: si rimuove l’accesso UI/route alle pagine vecchie, senza rompere relazioni storiche.

3. Sistemare il refresh alla radice
- Rendere `version.json` deterministico per ogni avvio/build, ma senza dipendere da un timestamp calcolato solo quando Vite parte: così il client rileva sempre bundle vecchio vs server nuovo.
- Rafforzare il controllo versione all’avvio e al ritorno focus: se il bundle è vecchio, svuota cache/browser cache storage e forza reload cache-busted.
- Correggere la discrepanza commenti/logica del throttle e ridurre i casi in cui l’app resta bloccata su una versione vecchia.

4. Disattivare definitivamente il rischio PWA cache
- Rimuovere il manifest dal `index.html` oppure renderlo innocuo se non serve come PWA installabile.
- Tenere i kill-switch `sw.js` e `service-worker.js` per disinstallare vecchi service worker già installati nei browser degli utenti.
- Aggiungere header no-store coerenti per i file statici critici dove configurabile.

5. Verifica
- Cercare nuovamente nel codice le stringhe legacy per assicurarsi che non siano più in sidebar/route navigabili.
- Controllare che il meccanismo di versione e purge cache sia coerente.
- Riavviare la preview se necessario, così il nuovo bundle viene servito subito.