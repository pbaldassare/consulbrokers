Confermo: dallo screenshot la preview dell’editor sta ancora mostrando il bundle vecchio con CONT. GENERALE, FATTURAPA, Area CFO e Provvigioni Consul. Il codice sorgente attuale della sidebar non le contiene più, quindi il problema è il caricamento/cache del bundle nella preview, non solo le route.

Piano operativo:

1. Rendere il refresh immediato davvero efficace
- Spostare il controllo versione prima del rendering React: se il bundle è vecchio, l’app non deve nemmeno montare la vecchia sidebar.
- Aggiungere una pagina HTML minima di “Aggiornamento in corso” mentre pulisce cache, service worker e storage.
- Forzare reload con URL cache-busted e, se serve, usare `location.reload()` come fallback.

2. Correggere il mismatch versione che oggi può loopare
- In `vite.config.ts` il valore di `APP_VERSION` viene generato con `new Date()` e può rendere diverso bundle/version.json a ogni restart/HMR.
- Lo sostituisco con una versione stabile basata su `APP_RELEASE_VERSION`, così il client non confronta valori incoerenti.
- Aggiorno `public/version.json` con lo stesso valore stabile.

3. Blindare la sidebar contro qualunque dato vecchio persistito
- Aggiungere una blacklist unica dei path/label legacy: `/contabilita-generale`, `/fatturapa`, `/fornitori`, `/banca-import`, `/area-cfo`, `/cfo`, `/provvigioni-sede`, e label CONT. GENERALE/FATTURAPA/Area CFO/Provvigioni Consul.
- Filtrare sia menu principale sia `Recenti/Preferiti` in sidebar, così storage vecchio non può ripresentare link eliminati.

4. Rimuovere il rumore dal contesto
- Ripulire `.lovable/plan.md` dai riferimenti alle pagine vecchie, per evitare che tornino come contesto operativo.

5. Verifica reale
- Cercare di nuovo tutte le occorrenze legacy nel codice applicativo.
- Aprire la preview e verificare visivamente che la sidebar non mostri più quelle voci.
- Se il browser tool non è autenticato, userò comunque screenshot/console disponibili e ti dirò esattamente cosa è stato verificato.