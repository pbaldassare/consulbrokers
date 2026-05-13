## Piano di correzione

1. **Sbloccare la tendina “Compagnia Assicurativa”**
   - Correggere la query in `ImmissionePolizzaPage`: `gruppi_compagnia` non ha la colonna `nome`, ma `codice` e `descrizione`.
   - Mostrare le opzioni come `codice - descrizione` e ordinare per `codice`/`descrizione`.
   - Questo risolve l’errore 400 attuale: `column gruppi_compagnia.nome does not exist`, che lascia vuota la compagnia e manda fuori sync il resto.

2. **Rendere coerente l’applicazione dei dati AI compagnia/agenzia**
   - Quando l’import AI seleziona un’agenzia (`compagnie.id`), impostare subito anche il relativo gruppo compagnia, senza aspettare effetti asincroni.
   - Se l’AI trova il gruppo ma non può scegliere automaticamente l’agenzia perché ce ne sono più di una, lasciare il gruppo selezionato e obbligare la scelta manuale dell’agenzia, evitando salvataggi incompleti.

3. **Migliorare il matching compagnia nell’import AI**
   - In `ImportNuovaPolizzaAIDialog`, mantenere la query sui gruppi con `descrizione`, ma rendere il match più robusto anche rispetto a `codice` e alle denominazioni presenti in `compagnie.nome`.
   - Se il PDF riporta un nome di agenzia/compagnia specifico, provare prima a trovare una `compagnie` attiva e da lì derivare `gruppo_compagnia_id`; altrimenti usare il fallback su `gruppi_compagnia`.

4. **Stabilizzare ramo/sottoramo dopo la compagnia**
   - Non cambiare la struttura `RamoSottoramoSelect` già corretta.
   - Verificare che il sottoramo venga impostato solo quando esiste un `ramo_id` valido; se il match è ambiguo, lasciarlo manuale invece di preselezionare un ramo sbagliato.

5. **CIG solo dove serve davvero**
   - In immissione polizza, mantenere il campo come riferimento facoltativo, ma non renderlo obbligatorio per `privato` o `azienda`.
   - Nel flusso “Nuovo Cliente” e nella revisione AI, confermare che il CIG venga richiesto solo se il Gruppo Finanziario classifica il cliente come `ente`.
   - Rimuovere/aggiornare messaggi che possano far pensare che sia richiesto per aziende o persone fisiche.

6. **Validazione finale**
   - Controllare i network log: la richiesta a `gruppi_compagnia` deve tornare 200.
   - Verificare in preview `/portafoglio/immissione` che la tendina compagnia si popoli, l’agenzia filtri correttamente e ramo/sottoramo restino coerenti.
