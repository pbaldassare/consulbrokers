Problema individuato: la schermata carica correttamente i dati reali da Supabase (`compagnie` e `gruppi_compagnia`), ma la UI attuale separa “Compagnia Assicurativa” come gruppo e “Agenzia di Riferimento” come singola compagnia/agenzia. Questo genera confusione e, quando il gruppo non viene risolto o la ricerca non trova il testo atteso, sembra che la compagnia non venga presa. Inoltre nei log recenti c’è stato un 400 su `gruppi_compagnia.nome`: lo schema reale usa `descrizione`, non `nome`.

Piano di correzione:

1. Rendere robusta la tendina “Compagnia Assicurativa”
   - Usare sempre i record da `gruppi_compagnia` con campi reali `id`, `codice`, `descrizione`.
   - Mostrare label chiare basate su `descrizione` e `codice`, non su una colonna `nome` inesistente.
   - Gestire esplicitamente errori di query con `toast`/fallback vuoto invece di fallire silenziosamente.

2. Rendere coerente la cascata Compagnia → Agenzia
   - Quando viene scelta una compagnia/gruppo assicurativo, filtrare le agenzie di riferimento tramite `compagnie.gruppo_compagnia_id`.
   - Quando viene scelta un’agenzia, sincronizzare automaticamente la compagnia/gruppo assicurativo associato.
   - Non svuotare inutilmente la scelta dell’agenzia se il gruppo è già coerente.

3. Migliorare la ricerca nelle tendine
   - Aggiornare `SearchableSelect` per usare valori univoci internamente e testo di ricerca separato, evitando problemi di `cmdk` con label duplicate o ricerca che mostra “Nessun risultato” pur avendo opzioni.
   - Mantenere compatibile il componente con tutti gli usi esistenti.

4. Validazione finale
   - Verificare che la pagina `/portafoglio/immissione` non faccia più richieste a `gruppi_compagnia.nome`.
   - Verificare che “Compagnia Assicurativa” mostri risultati e che, dopo la selezione, “Agenzia di Riferimento” venga popolata correttamente.
   - Verificare che il payload di salvataggio continui a salvare `compagnia_id` dalla singola agenzia selezionata, come previsto dal database.