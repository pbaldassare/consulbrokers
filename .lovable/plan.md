

## Piano: Appendici con modifica completa (edit, cancella, aggiorna testo/file)

### Problema
Attualmente le appendici possono solo essere create e cancellate. Non è possibile modificare un'appendice esistente (testo, oggetto, tipo, date, file allegato, note).

### Soluzione
Aggiungere la modalità **editing** nella stessa pagina `AppendiciPolizzaPage.tsx`:

1. **Pulsante "Modifica"** (icona Edit/Pencil) nella colonna azioni di ogni riga della tabella, accanto a Visualizza e Elimina.

2. **Click su Modifica** → popola il form "Nuova Appendice" con i dati dell'appendice selezionata (numero, date, tipo, oggetto, testo, note). Il titolo della fieldset cambia in "Modifica Appendice #N". Il pulsante Salva diventa "Aggiorna Appendice".

3. **Aggiornamento**: usa `.update()` su `appendici_polizza` anziché `.insert()`. Se viene caricato un nuovo file, elimina il vecchio dallo storage prima di uploadare il nuovo. Se l'utente cancella il file senza sostituirlo, rimuove `file_path`/`nome_file`.

4. **Pulsante "Annulla modifica"** per tornare alla modalità creazione e resettare il form.

5. **Conferma eliminazione**: aggiungere un `AlertDialog` prima di cancellare un'appendice per evitare eliminazioni accidentali.

### File coinvolto
- `src/pages/AppendiciPolizzaPage.tsx` — aggiunta stato `editingId`, logica di populate form, mutation update, UI pulsante modifica + annulla + conferma eliminazione

