Hai ragione: dallo screenshot il browser sta ancora mostrando un bundle/sidebar vecchio con `CONT. GENERALE`, `FATTURAPA`, `Area CFO` e `Provvigioni Consul`, mentre nel sorgente attuale `AppSidebar.tsx` non contiene più quelle voci. Quindi il problema non è solo “route vecchie”: è anche un vecchio bundle che resta visibile nella preview/pubblicato.

Piano di intervento:

1. **Pulizia definitiva dei riferimenti legacy rimasti**
   - Rimuovere anche le route redirect residue per pagine eliminate da mesi: `/contabilita-generale/*`, `/fatturapa/*`, `/fornitori/*`, `/banca-import/*`, oltre a `/area-cfo`, `/cfo`, `/provvigioni-sede`.
   - Farle cadere nella gestione standard 404/redirect globale, invece di mantenerle come pagine “conosciute”.
   - Eliminare riferimenti testuali legacy rimasti in `.lovable/plan.md` se continuano a confondere il contesto.

2. **Blindare il menu contro voci stale**
   - Aggiungere una blacklist esplicita dei path legacy nel layer di navigazione/sidebar, così anche se una configurazione vecchia o dati persistiti provano a renderli, non appaiono.
   - Verificare anche `RecentiPreferitiSidebar`, perché potrebbe riproporre link vecchi da storage/preferiti/recenti anche dopo la rimozione dal menu principale.

3. **Forzare refresh reale del bundle**
   - Aumentare `APP_RELEASE_VERSION` e aggiornare `public/version.json`.
   - Verificare che `AppVersionGuard` e `versionCheck` svuotino service worker, cache storage, localStorage/sessionStorage non essenziali e ricarichino con cache-bust.
   - Se necessario, rendere il purge più aggressivo solo per chi ha ancora route/menu legacy salvati.

4. **Verifica finale**
   - Cercare nel codice tutte le occorrenze di `fatturapa`, `contabilita-generale`, `CONT. GENERALE`, `Area CFO`, `Provvigioni Consul`, `provvigioni-sede`.
   - Confermare che nessuna voce legacy sia renderizzabile dal menu e che gli URL vecchi non abbiano più una route dedicata.
   - Lasciare solo le pagine attuali di contabilità e provvigioni.