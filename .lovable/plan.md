Hai ragione: il problema non è solo cache. Dallo stato attuale si vede che la route `/portafoglio/estrazioni-stampe` sta ancora renderizzando la vecchia pagina con le vecchie card, mentre il nuovo E/C Agenzie è stato collegato solo sotto Contabilità. Inoltre il controllo versione ha un anti-loop troppo aggressivo: se ha già provato un reload per la stessa versione, poi lascia comunque renderizzare la UI vecchia.

Piano di intervento:

1. Collegare prima la nuova configurazione E/C Agenzie nella pagina corretta
   - Aggiornare `src/pages/EstrazioniStampePage.tsx` aggiungendo/modificando le card per includere il flusso E/C Agenzie.
   - La card deve puntare direttamente alla pagina operativa nuova: `/contabilita/ec-compagnia`.
   - Aggiungere anche, se utile, la card storico: `/contabilita/ec-agenzia/storico`.
   - Mantenere lo stile delle card esistenti, senza introdurre layout diverso.

2. Allineare sidebar e nomenclatura per evitare doppie configurazioni
   - Verificare che nel menu non restino voci ambigue tipo “E/C Compagnia” quando l’utente deve vedere “E/C Agenzie”.
   - Tenere un solo ingresso coerente verso il nuovo flusso E/C Agenzie.
   - Non eliminare le route tecniche esistenti, ma rendere la navigazione utente coerente.

3. Sistemare il blocco del controllo versione
   - Correggere `src/lib/versionCheck.ts`: oggi nei log compare `reload già eseguito ... — skip`, quindi la vecchia UI può rimanere in memoria.
   - Se bundle e `/version.json` non coincidono, non deve semplicemente “saltare”: deve impedire la visualizzazione della UI vecchia e forzare un refresh pulito con un parametro cache-busting diverso.
   - Evitare loop infiniti con un contatore limitato, non con un singolo flag permanente per versione.

4. Rendere il boot più sicuro
   - In `src/main.tsx`, se il version check rileva mismatch o reload in corso, lasciare il loader e non montare React.
   - Ripulire eventuali parametri `app_v` vecchi dopo un caricamento corretto.
   - Mantenere la pulizia di service worker/cache già implementata.

5. Ridurre il rischio di configurazioni obsolete lato browser
   - Aggiungere una piccola funzione di “hard refresh” più robusta: `app_v=<versione>-<timestamp>`.
   - Se dopo 2 tentativi la versione resta diversa, mostrare un messaggio chiaro di aggiornamento invece di caricare schermate vecchie.

6. Verifica finale
   - Verificare che da `/portafoglio/estrazioni-stampe` si vedano subito le card aggiornate, inclusa E/C Agenzie.
   - Verificare che cliccando E/C Agenzie si arrivi al nuovo flusso già implementato con selezione titoli, anteprima, stampa, salvataggio e storico.
   - Verificare che il controllo versione non lasci più renderizzare una configurazione vecchia dopo il primo tentativo di refresh fallito.