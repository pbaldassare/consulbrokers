Ho verificato il codice: il menu non mostra più FatturaPA come voce reale, ma sono rimasti riferimenti legacy che possono far comparire pagine vecchie o link errati:

- Sidebar: `Area CFO` è ancora una voce visibile per admin perché l'admin passa sempre tutti i permessi.
- Route: `/cfo` è ancora registrata e quindi raggiungibile.
- Sitemap/permessi/breadcrumb: contengono ancora testi come `FatturaPA`, `Contabilità Generale`, `Area CFO`, `cont-generale`.
- Cruscotto contabilità: c'è un link a `/cont-generale/scadenziario`, pagina non più esposta.
- Search globale: alcuni risultati puntano a `/cfo` e `/prodotti`, creando navigazioni vecchie/rotte.
- Route contabilità: importa ancora pagine di contabilità generale non usate; non vengono renderizzate, ma vanno tolte per non lasciare ambiguità.

Piano di correzione:

1. Ripulire la sidebar
   - Rimuovere completamente `Area CFO` da `AppSidebar`.
   - Eliminare import/icona inutili collegati a quella voce.
   - Lasciare visibili solo le sezioni attive: Home, Trattative, Bandi, Chat, Portafoglio, Archivio Documentale, Anagrafiche Utenti, Sinistri, Contabilità, Sistema, Provvigioni, Notifiche.

2. Bloccare le route legacy
   - Rimuovere la route `/cfo` da `src/routes/sistema.tsx`.
   - Togliere l'import di `AreaCFO`.
   - Aggiungere redirect sicuri dalle vecchie URL principali verso pagine attive, per evitare che un link salvato apra pagine vecchie:
     - `/cfo` → `/contabilita/cruscotto`
     - `/cont-generale/*` → `/contabilita`
     - `/fatturapa/*` → `/contabilita`
     - `/prodotti` e `/categorie` → `/compagnie` o tabelle corrette se già gestite lì.

3. Pulire Contabilità da import e link obsoleti
   - Rimuovere da `src/routes/contabilita.tsx` gli import non usati di contabilità generale (`PrimanotaGeneralePage`, `ScadenziarioPage`, `ElabPeriodichePage`, `ClientiContabGeneralePage`, `DichiarativiCUPage`, `ElabAnnualiPage`, `FornitoriPage`, `BancaImport`, `PianoDeiContiPage`, icone inutili).
   - Cambiare nel `CruscottoGiornaliero` il link `Vedi scadenziario` da `/cont-generale/scadenziario` a una pagina attiva o rimuovere il bottone se la sezione non deve esistere più.

4. Aggiornare ricerca globale
   - Cambiare i risultati “provvigioni non pagate” che oggi puntano a `/cfo`, facendoli puntare a `/pagamenti-provvigioni` o `/provvigioni-maturate`.
   - Cambiare i risultati prodotto da `/prodotti` a `/compagnie` oppure non renderli cliccabili verso route inesistenti.

5. Pulire breadcrumb, sitemap e permessi visibili
   - Rimuovere/aggiornare label legacy in `PageBreadcrumb`: `fatturapa`, `cont-generale`, `cfo`.
   - Aggiornare `SitemapPage` eliminando `FatturaPA`, `Contabilità Generale`, `Area CFO` e riferimenti a fornitori/scadenziario se non fanno parte della visualizzazione attiva.
   - Aggiornare `userLevels.ts` rinominando o togliendo `cfo_area` dalla visualizzazione dei permessi, così non appare più come area funzionale attiva.

6. Correggere link rotti già esistenti
   - I pulsanti “Chiudi” in varie pagine polizza puntano a `/portafoglio/gestione-polizze`, route non registrata: li aggiorno a `/portafoglio/attive` o alla pagina titolo quando disponibile.

7. Verifica finale
   - Ricerca testuale per confermare che non restino più riferimenti visibili a `FatturaPA`, `Contabilità Generale`, `Area CFO`, `/cfo`, `/cont-generale`, `/fatturapa`.
   - Controllo che sidebar e route puntino solo a pagine attive.
   - Se il browser è disponibile e l'utente è loggato, verifico la sidebar nella preview; se chiede login, segnalo che serve accedere in preview.

Risultato atteso: spariscono definitivamente dalla visualizzazione e dai link navigabili le vecchie pagine come FatturaPA/Contabilità Generale/Area CFO, evitando anche che ricerche, breadcrumb o link interni le ripropongano.