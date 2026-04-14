
Obiettivo

Far sì che il salvataggio di un’appendice in modifica aggiorni sempre il record corrente e non apra la creazione di una nuova appendice finché l’utente non sceglie esplicitamente di uscire dalla modifica.

Problema trovato

Ho verificato il flusso reale:
- il primo click in modifica esegue correttamente un `PATCH` su `appendici_polizza`
- subito dopo, `onSuccess` chiama `resetForm()`, quindi azzera `editingId`
- la pagina resta con `appendiceId` nell’URL ma torna in modalità creazione
- i salvataggi successivi fanno `POST` e generano appendici nuove (`2`, `3`, ...)

Quindi il bug non è nel database: è nello stato UI dopo l’update.

Intervento

1. Correggere il post-save in `src/pages/AppendiciPolizzaPage.tsx`
- distinguere in modo stabile create vs update dentro la mutation
- dopo un update non chiamare `resetForm()`
- restare in modalità modifica e lasciare il bottone su `Aggiorna Appendice`
- chiamare `resetForm()` solo dopo una vera creazione

2. Riallineare form, file e record salvato
- far ritornare dalla mutation il record aggiornato (`update(...).select().single()`)
- dopo il salvataggio richiamare `startEdit(recordSalvato)` così si aggiornano anche `existingFilePath`, `existingFileName`, `file`, `removeExistingFile`
- evitare che una seconda modifica riusi riferimenti file vecchi o già rimossi

3. Sistemare il deep-link di modifica
- usare anche `setSearchParams`
- rendere `appendiceId` la fonte di verità della modalità edit
- quando si entra in modifica, mantenere/impostare `appendiceId`
- quando si annulla la modifica o si vuole creare una nuova appendice, rimuovere `appendiceId` dall’URL
- semplificare o rimuovere `deepLinkHandled`, che oggi blocca il rientro corretto in edit dopo i refresh dati

4. Rifiniture UX
- mantenere sempre `Aggiorna Appendice` in edit e usare `Crea Appendice` in create
- lasciare evidenziata la riga in modifica
- toast distinti: `Appendice aggiornata` / `Appendice creata`

Verifica finale

- aprire un’appendice da `/titoli/:id`
- modificare oggetto, note, testo o file e salvare
- verificare che parta solo `PATCH`, non `POST`
- cliccare di nuovo salva senza uscire: deve aggiornare sempre lo stesso record
- cliccare “Annulla modifica” o tornare a create mode: solo da lì il salvataggio deve creare un nuovo record

File coinvolto

- `src/pages/AppendiciPolizzaPage.tsx`

Dettaglio tecnico

Nessuna migrazione database necessaria.
