# Fix totale SSN errato

## Problema
Su polizza con netto 438,59 € e aliquota SSN 10,5% il totale SSN mostra **53,42 €** invece dei corretti **46,05 €**.

Causa: in `src/components/polizze/PremiGaranziaCardShell.tsx` la funzione `calcSsn` usa `(netto + tasse) × aliquota%`, mentre per RCA la base imponibile SSN è il **solo netto** (come già documentato in `rca-voci-composizione-premio`).

## Modifica

**`src/components/polizze/PremiGaranziaCardShell.tsx`**
- `calcSsn(netto, _tasse, aliquotaSsn)` → ritorna `+(netto * aliquotaSsn / 100).toFixed(2)`. Il parametro `tasse` resta nella firma per non toccare i call-site, ma viene ignorato.

Risultato: 438,59 × 10,5% = **46,05 €**. Totale lordo = 438,59 + 70,17 + 46,05 = 554,81 €.

## Memory update
- Aggiornare `mem://insurance/ssn-contribution.md`: la formula corretta è `ssn = netto × aliquota_ssn / 100` (non più su netto+tasse), allineata con `rca-voci-composizione-premio`.

## Version bump
- `public/version.json` → nuovo timestamp.
