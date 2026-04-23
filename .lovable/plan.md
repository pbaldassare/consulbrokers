

## Fix campi Premio non modificabili nel dialog di Rinnovo

### Causa

Nel dialog `RinnovoTitoloDialog.tsx` i 5 campi premio (Lordo, Netto, Tasse, Addizionali, Provvigioni) sono `<Input type="number" value={form.premio_lordo}>` con `value` di tipo **number** (non string). Questo crea due problemi che impediscono di scrivere:

1. **Cancellazione blocca l'input**: quando l'utente seleziona "300" e digita una nuova cifra, lo state diventa momentaneamente vuoto → `parseFloat("") = NaN → || 0` → React riscrive `0` nel campo, il cursore torna in fondo, sembra che "non si possa scrivere".
2. **Cifre decimali si perdono**: digitando "245," (virgola/punto intermedio) `parseFloat` ritorna 245 e l'input viene risincronizzato a "245", impedendo di completare "245.39".

Inoltre c'è un warning React (`FieldRow` non usa `forwardRef`) lanciato da `TitoloDetail.tsx` che inquina la console ma non blocca il dialog.

### Fix in `src/components/polizze/RinnovoTitoloDialog.tsx`

**Convertire i 5 campi premio in `string` editabile** (stesso pattern già usato in `TitoloDetail.tsx → importiForm`):

1. Cambiare il tipo dello state `form` per i 5 campi premio da `number` a `string` (`premio_lordo: ""`, ecc.).
2. In `useEffect` precompilare con `String(Number(lordoBase) || 0)` invece di `Number(...)`.
3. Negli `onChange` salvare direttamente `e.target.value` (string), senza `parseFloat`.
4. Nella `mutationFn`, al momento dell'insert su `titoli`/`movimenti_polizza`, convertire con `parseFloat(form.premio_lordo) || 0` (e così per gli altri).

Questo permette: scrivere/cancellare liberamente, inserire decimali con virgola o punto, mantenere il cursore stabile.

### Fix collaterale: warning `FieldRow` ref

In `src/pages/TitoloDetail.tsx` (riga ~59) il componente `FieldRow` è una function component ma viene usata in contesti (`AccordionTrigger` / `Tooltip`) che le passano un `ref`. Avvolgerlo con `React.forwardRef` per eliminare il warning rosso ricorrente in console.

### Cosa NON tocco

- Il flusso di rinnovo, la mutation, i payload DB (i numeri arrivano comunque corretti perché convertiti in `parseFloat` al momento dell'insert).
- Le date del dialog (già funzionano).
- La sezione "Importi" su `TitoloDetail` (è read-only di proposito con pulsante "Modifica" — funziona già).

### Verifica

1. Apro polizza 332437574 → Rinnovo → clicco su "Premio Lordo": cancello "300" e digito "350,75" → il campo accetta tutta la sequenza, il cursore non salta indietro.
2. Modifico anche Premio Netto, Tasse, Provvigioni → tutti scrivibili senza scatti.
3. Confermo rinnovo → il nuovo titolo creato ha `premio_lordo = 350.75` (controllo nel detail del nuovo titolo).
4. Console: il warning `Function components cannot be given refs … FieldRow` non compare più.

