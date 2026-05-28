Problema individuato: il cliente Agnone ha davvero il Gruppo Finanziario salvato in DB (`AZ_PART_PUB`, tipo `ente`). Il blocco resta perché la query frontend di `ImmissionePolizzaPage` fallisce con errore 400: sta chiedendo colonne inesistenti su `clienti` (`indirizzo`, `cap`, `citta`, `provincia`). Quando la query fallisce, `clienteDettaglio` non viene popolato e la UI interpreta il cliente come senza Gruppo Finanziario.

Piano di fix:

1. Correggere la query del dettaglio cliente in `ImmissionePolizzaPage`
   - Sostituire i campi inesistenti con quelli reali:
     - `indirizzo_residenza`, `cap_residenza`, `citta_residenza`, `provincia_residenza`
     - `indirizzo_sede`, `cap_sede`, `citta_sede`, `provincia_sede`
   - Mantenere `gruppo_finanziario_id`, `tipo_cliente` e l’embed del Gruppo Finanziario.

2. Rendere robusto il recupero del Gruppo Finanziario
   - Usare l’hint esplicito della FK nell’embed:
     `gruppi_finanziari!clienti_gruppo_finanziario_id_fkey(id, codice, nome, tipo_soggetto)`
   - Se l’embed non torna ma `gruppo_finanziario_id` esiste, fare una seconda query mirata su `gruppi_finanziari`.
   - Mostrare il banner “mancante” solo se manca davvero `gruppo_finanziario_id`, non se è fallita una query.

3. Correggere il copia-dati “Conducente = Contraente”
   - Per privati usare i campi residenza.
   - Per aziende/enti usare i campi sede.
   - Così non userà più `c.indirizzo`, `c.cap`, `c.citta`, `c.provincia` che non esistono sulla tabella clienti.

4. Riapplicare/garantire i permessi Data API su `gruppi_finanziari`
   - La lettura DB mostra che i grant attivi risultano ancora assenti.
   - Aggiungere in migration idempotente:
     - utenti autenticati possono leggere `gruppi_finanziari`
     - `service_role` ha accesso completo
   - Nessun accesso anonimo.

5. Verifica finale
   - Ricaricare `/portafoglio/immissione?clienteId=f59cb208-126c-4e8e-a62d-6226d3707185`.
   - Confermare che compare il badge “Ente · AZ_PART_PUB” e sparisce il blocco.
   - Verificare che CIG/Rif. mantenga le regole già richieste: 10 caratteri e flag provvisorio.