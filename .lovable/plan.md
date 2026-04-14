
Problema reale

Do I know what the issue is? Sì.

Ho verificato il flusso:
- sei nella pagina appendici in modalità creazione (`/portafoglio/appendici?...` senza `appendiceId`)
- i click su Salva stanno facendo veri `POST` su `appendici_polizza`
- dopo ogni creazione il form torna subito pronto per una nuova appendice e precompila il numero successivo
- quindi i click successivi non aggiornano il record appena creato: generano nuove appendici (`2`, `3`, `4`, ...)

Quindi il bug non è nel database: è nel flusso UI dopo la creazione.

Intervento

1. Stabilizzare create/update in `src/pages/AppendiciPolizzaPage.tsx`
- far ritornare anche la create con `.insert(...).select().single()`
- dopo una creazione chiamare `startEdit(recordCreato)` invece di `resetForm()`
- impostare `appendiceId` nell’URL, così la pagina resta agganciata al record appena creato
- dopo il primo salvataggio il bottone deve diventare `Aggiorna Appendice`, non restare in create mode

2. Creare una vera azione “Nuova Appendice”
- aggiungere un pulsante dedicato per uscire dal record corrente
- solo questo pulsante farà reset del form, rimozione di `appendiceId` e preparazione del numero successivo
- il successo del salvataggio non deve più aprire automaticamente una nuova appendice

3. Bloccare i salvataggi ripetuti
- aggiungere un guard anti-doppio click sincrono oltre a `isPending`
- disabilitare Salva/Aggiorna quando non ci sono modifiche reali da salvare
- in create mode evitare che un form appena resettato possa generare subito un’altra appendice per click ripetuti

4. Rifiniture UX
- toast distinti: `Appendice creata` / `Appendice aggiornata`
- riga in modifica sempre evidenziata
- pulsanti chiari: `Nuova Appendice`, `Aggiorna Appendice`, `Annulla modifica`

Verifica finale
- creare una nuova appendice e cliccare Salva più volte: deve restare sullo stesso record, non crearne altre
- dopo la create il pulsante deve essere `Aggiorna Appendice`
- solo cliccando `Nuova Appendice` deve comparire il numero successivo
- senza modifiche reali il salvataggio non deve partire
- verificare che il deep-link da `/titoli/:id` continui a funzionare

File coinvolto
- `src/pages/AppendiciPolizzaPage.tsx`

Dettaglio tecnico
- nessuna migrazione database necessaria per correggere questo bug
- il fix è interamente nel flusso client di create/edit e nel blocco dei salvataggi ripetuti
