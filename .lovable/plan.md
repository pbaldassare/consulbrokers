## Problema

Nella card "Premi per Garanzia — Firma/Quietanza" inserendo `476,50` come Premio Lordo (o Netto) la UI mostra valori sbagliati (`4,11` / `0,66` / `0,43` / `5,20`): il valore digitato viene troncato o frainteso. La causa è il combo `<input type="number">` + `parseFloat`:

- `type="number"` con locale italiano gestisce la virgola in modo incoerente fra browser: spesso `e.target.value` torna stringa vuota mentre l'utente digita `476,5`, oppure tiene solo le prime cifre valide.
- `parseFloat("476,5")` ritorna `476` (perde la parte decimale); `parseFloat("4,76")` ritorna `4`.
- L'utente vede così numeri "casuali" perché il valore digitato non viene mai parsato per intero.

File interessato: `src/components/polizze/PremiGaranziaCardShell.tsx`
(stessi input usati sia in card Firma che Quietanza).

## Cosa fare

1. **Helper di parsing IT** (in cima al file, o in `src/lib/number.ts` se non esiste già): 
   - `parseDecimalIt(value: string): number | null` — trim, rimuove spazi e separatore migliaia `.` quando seguono pattern `\d{1,3}(\.\d{3})+,\d+`, sostituisce ultima `,` con `.`, poi `parseFloat`. Ritorna `null` se vuoto o NaN.
   - `formatDecimalIt(n: number, dec=2)` — `n.toLocaleString("it-IT",{minimumFractionDigits:dec,maximumFractionDigits:dec})` per le celle non editabili (lordo riga / totali) — opzionale, già ok.

2. **Cambiare gli `<Input>` editabili** (Netto, Tasse, SSN, Lordo riga):
   - `type="number"` → `type="text"` con `inputMode="decimal"` e `pattern="[0-9.,]*"` (mobile keyboard numerica con virgola).
   - `value={r.netto}` resta una stringa (già lo è). Mostriamo quello che l'utente ha digitato, senza riformattare a ogni keystroke.
   - `onBlur`: normalizzare la stringa con `parseDecimalIt` → se valido, riscrivere il campo come `n.toFixed(2)` (formato canonico `.` come separatore decimale, coerente con come è salvato oggi nello state).

3. **Aggiornare gli handler** `handleNettoChange`, `handleTasseChange`, `handleLordoChange` (e ricalcoli derivati):
   - Sostituire ogni `parseFloat(value)` / `parseFloat(r?.netto ?? "0")` con `parseDecimalIt(...) ?? 0`.
   - Mantenere `value` come stringa originale dell'utente nello state (non sovrascrivere durante la digitazione), così non si "perde" la virgola mentre si scrive.
   - I ricalcoli automatici di tasse / ssn restano, ma scritti in formato `nnn.nn` (compatibile con tutto il resto del codice che già usa `parseFloat`).

4. **Tot/somme** (`totNetto`, `totTasse`, `totSsn`, riga 128-131) e i punti che fanno `parseFloat(r.netto ?? "0")` dentro lo stesso file: passare a `parseDecimalIt` per essere consistenti se la stringa contiene una virgola transitoria prima del blur.

5. **Non toccare**:
   - Lo schema DB, le edge functions, gli altri form (StornoTitoloDialog, RegolazionePremioDialog ecc.): la stessa fix andrà eventualmente replicata in seguito, ma è fuori scope per questo bug.
   - Le righe non editabili che mostrano già `toFixed(2)` (Totali, Premio Lordo): restano com'è.

## Verifica

1. `/portafoglio/immissione?clienteId=…`, ramo `ZQ – R.C.A.`, sottoramo `R. C. MOTO`, aliquota 16%.
2. In Premio Lordo digitare `476,50` → al blur deve mostrare `Netto 410,78 · Tasse 65,72 · Lordo 476,50` (con SSN se attivo: ssn 50,00, lordo totale ~526,50).
3. Provare gli stessi valori sia con `,` che con `.` come separatore decimale → stesso risultato.
4. Provare `1.234,56` (separatore migliaia + decimale) → 1234.56.
5. Mentre digito `476,5` la cifra rimane visibile e non viene sovrascritta a ogni keystroke.
6. Provvigioni e totali nella riga riepilogo Importi (Totale Netto/Tasse/SSN/Lordo) coerenti.

## Tecnico — riassunto modifiche file

`src/components/polizze/PremiGaranziaCardShell.tsx`:
- aggiungere `parseDecimalIt` helper (top file)
- handler `handleNettoChange`, `handleTasseChange`, `handleLordoChange`, `handleSsnChange`: usare helper, NON riformattare la stringa digitata
- 4 `<Input type="number">`: → `type="text"` + `inputMode="decimal"` + `onBlur` di normalizzazione
- `parseFloat` interni: sostituiti con `parseDecimalIt`
