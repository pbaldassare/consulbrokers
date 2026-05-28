Il cliente selezionato è correttamente catalogato come Ente nel database (`tipo_soggetto = ente`), quindi il CIG deve comparire ed essere obbligatorio.

Piano di intervento:

1. Correggere la query del dettaglio cliente in `ImmissionePolizzaPage.tsx` includendo anche `tipo_cliente`, perché oggi il fallback a Ente esiste nel codice ma la colonna non viene caricata.
2. Rendere più robusta la lettura del `tipo_soggetto` dal gruppo finanziario, gestendo sia relazione singola sia array Supabase, così `cigObbligatorio` diventa true quando il cliente è Ente.
3. Lasciare il campo CIG nella sezione `Contratto`, subito dopo N° Polizza e prima di Vincolo: per il Comune di Agnone comparirà con asterisco rosso e bloccherà il salvataggio se vuoto.
4. Verificare che il payload continui a salvare `cig_rif` e `cig_temporaneo` su `titoli` senza modifiche al database.