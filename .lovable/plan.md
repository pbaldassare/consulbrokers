

## Nascondi sezione "Premio (modificabile)" dal dialog di Rinnovo

### Obiettivo

Nello screenshot del dialog `Rinnovo Polizza` (polizza 332437574), nascondere completamente la sezione **"Premio (modificabile)"** con i 5 campi: Premio Lordo, Premio Netto, Tasse, Addizionali, Provvigioni. Restano visibili solo l'header riepilogativo e la sezione **"Nuovo Periodo"** (Durata Da/A, Data Scadenza, Data Competenza, Garanzia Da/A).

### Modifica in `src/components/polizze/RinnovoTitoloDialog.tsx`

1. **Rimuovere il blocco JSX** della sezione "Premio (modificabile)" — il `<div>` che contiene il titolo "Premio (modificabile)" e i 5 `<Input>` (premio_lordo, premio_netto, tasse, addizionali, provvigioni).
2. **Mantenere lo state `form` invariato** per i 5 campi premio: vengono comunque precompilati nell'`useEffect` con i valori del titolo origine e usati nella `mutationFn` per creare il nuovo titolo. Quindi il rinnovo continua a copiare correttamente i premi dal titolo precedente — semplicemente non sono più modificabili dall'UI.
3. **Non toccare** la mutation, gli insert su `titoli`/`movimenti_polizza`, le date, l'header riepilogativo, i pulsanti Annulla/Conferma.

### Risultato

Il dialog diventa più compatto: header → "Nuovo Periodo" (date) → pulsanti. Il rinnovo creerà il nuovo titolo con gli stessi premi del titolo origine (comportamento di default già presente). Se in futuro servirà rieditarli, lo si può fare dal `TitoloDetail` del nuovo titolo tramite la sezione "Importi" (già editabile con il pulsante "Modifica").

### Verifica

1. Apro polizza 332437574 → Rinnovo: il dialog mostra solo header + Nuovo Periodo (date) + pulsanti, **senza** la sezione "Premio (modificabile)".
2. Confermo Rinnovo: il nuovo titolo viene creato con `premio_lordo=300`, `premio_netto=245.39`, `tasse=54.61`, `addizionali=0`, `provvigioni=35.33` (stessi valori del titolo origine).
3. Apro il detail del nuovo titolo → sezione "Importi" mostra gli stessi premi e resta editabile col pulsante "Modifica" come prima.

