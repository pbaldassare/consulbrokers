# Fix: mostrare l'aliquota di default del sottoramo

## Problema
In `PremiGaranziaCardShell` la colonna "Aliquota %" usa `aliquotaCalc = tasse/netto*100` (riga 174). Finché netto è vuoto, mostra `0.00` anche se il sottoramo selezionato (es. EC—CRISTALLI 22,25%) ha già caricato `aliquotaTasse` nello stato della riga. Risultato: l'utente crede che l'aliquota non sia stata presa.

## Soluzione
Cambiare la logica di display nella cella "Aliquota %":

- Se `netto > 0` → mostra `(tasse/netto)*100` (aliquota effettivamente applicata, utile per verificare override manuali sulle tasse).
- Se `netto = 0` → mostra `r.aliquotaTasse` (aliquota di default dal sottoramo).

Inoltre, all'auto-popolazione delle tasse alla selezione sottoramo (`handleGaranziaSelect` riga 117): se l'utente non ha ancora messo netto, le tasse restano "" — corretto. Nessuna altra modifica al calcolo.

## File
- `src/components/polizze/PremiGaranziaCardShell.tsx` — solo la riga 174 e il rendering della cella riga 213-215.

## Validazione
- Selezionare Ramo `ZQ - R.C.A.` poi sottoramo `EC - CRISTALLI` con netto vuoto → la colonna "Aliquota %" mostra `22.25`.
- Inserire netto = 100 → tasse si popolano a 22,25 e colonna mostra `22.25`.
- Editare manualmente le tasse a 30 con netto 100 → colonna mostra `30.00` (aliquota effettiva).
- Cambiare sottoramo a uno con aliquota 0 (es. `BB - BBB`) → mostra `0.00`.
