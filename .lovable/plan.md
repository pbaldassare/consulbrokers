## Obiettivo
Permettere all'operatore di digitare l'importo della compensazione contabile (es. `138,47`) in modo naturale, senza che il valore venga riformattato a ogni tasto né bloccato a un singolo numero alla volta.

## Modifiche (un solo file: `src/components/portafoglio/MessaCassaDialog.tsx`, componente `CompensazioniPanel`)

1. **Buffer di digitazione locale**
   - Sostituire l'input controllato sul numero con un input controllato su una stringa locale (`useState<Record<string, string>>` per `tempId → testo digitato`).
   - All'apertura della riga, inizializzare il buffer con il valore corrente formattato in stile italiano (es. `138,47`); stringa vuota se importo = 0 e non c'è suggerimento.
   - Su `onChange`: accettare solo cifre, `.` e `,`; aggiornare solo il buffer (nessun round, nessun reset dello stato globale → niente "scatti").
   - Su `onBlur` (e su `Enter`): parse del buffer (sostituendo `,` con `.`), `round2`, e salvataggio in `compensazioniByTitolo`. Se buffer vuoto → 0.

2. **Accessibilità & UX**
   - `type="text"` con `inputMode="decimal"` per mostrare la tastiera numerica su mobile.
   - `placeholder="0,00"`.
   - Aumentare la larghezza a `w-32` e mantenere allineamento a destra.
   - Auto-focus dell'input importo quando si aggiunge una nuova causale (così l'utente parte già pronto a digitare).
   - Suffisso visivo `€` (icona o testo grigio nel campo) per chiarezza.

3. **Coerenza con i totali**
   - Tutti i totali (`totaleCompPlus`, `totaleCompMinus`, `dovutoFinale`, preview movimenti) restano agganciati a `compensazioniByTitolo` — quindi si aggiornano solo al blur, evitando re-render rumorosi durante la digitazione. Questo è il comportamento atteso e già usato in altri form del progetto.

4. **Validazione minima**
   - Se l'utente lascia un buffer non parsabile (es. lettere), su blur si fa fallback a 0 senza errori (l'operatore vede il campo tornare vuoto / a `0,00`).
   - Niente cambiamenti sul resto del flusso di salvataggio (`handleConferma`), perché i valori persistiti restano numerici già arrotondati.

## Fuori scope
- Nessuna modifica allo schema DB o alle tabelle `titoli_compensazioni`.
- Nessuna modifica alla pagina di dettaglio compensazioni o all'export Excel.
- Nessun cambiamento agli anticipi cliente o agli altri campi del dialog.

## Verifica manuale
- Aprire Messa a Cassa su un titolo (es. polizza 434334433 dello screenshot).
- Aggiungere causale "SCONTO", digitare `138,47` → il campo deve accettare tutta la sequenza senza scatti.
- Cliccare fuori: il blocco "Compensazioni che riducono dovuto" deve mostrare `− 138,47 €` e il delta deve aggiornarsi.
- Cancellare il valore → al blur il campo mostra `0,00` e la riga sparisce dai totali.
