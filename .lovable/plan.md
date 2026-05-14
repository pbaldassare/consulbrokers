# Fix salvataggio polizza: colonna `percentuale_provvigione` inesistente

## Problema

Al click su "Conferma" l'INSERT su `titoli` fallisce con:

> Could not find the 'percentuale_provvigione' column of 'titoli' in the schema cache

In `src/pages/ImmissionePolizzaPage.tsx` riga **767** il payload contiene:

```ts
percentuale_provvigione: percentualeProvvigione ? parseFloat(percentualeProvvigione) : null,
```

Ma la tabella `titoli` non ha tale colonna (verificato su DB: esistono solo `percentuale_commerciale`, `percentuale_riparto`, `provvigioni_firma`, `provvigioni_quietanza`).

Il valore `percentualeProvvigione` (% Agenzia su netto) è già usato per calcolare gli importi assoluti `provvFirma` / `provvQuietanza` salvati in `provvigioni_firma` / `provvigioni_quietanza`. Non serve persisterla.

## Fix

File: `src/pages/ImmissionePolizzaPage.tsx`

1. Rimuovere la riga 767 dal payload INSERT.
2. Verifico anche eventuali altri usi della stessa stringa nel file: il blocco lookup (righe 638-655) interroga `produttori_provvigioni_ramo.percentuale_provvigione` — colonna esistente in **quella** tabella, va lasciata invariata.

## Out of scope

- Nessuna modifica a schema DB.
- Nessuna modifica al componente `PremiGaranziaCardShell`.
