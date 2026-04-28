## Obiettivo

Sulla pagina **Modifica Polizza** (`TitoloDetail.tsx`), allineare la voce "Compagnia" alla nuova convenzione già applicata in Immissione: rinominarla in **"Compagnia / Agenzia di rif."** e mostrare nella select il gruppo madre come riga secondaria.

## Contesto

In Immissione Polizza la modifica è già stata fatta: `compagnie` rappresenta la combinazione Compagnia + Agenzia, e la select mostra `{codice} - {nome agenzia}` con sotto `Gruppo: {gruppo_compagnia}`. In `TitoloDetail.tsx` invece la label è ancora "Compagnia" sia in lettura che in modifica → refuso da correggere.

## Modifiche puntuali in `src/pages/TitoloDetail.tsx`

1. **Query `compagnieOpts`** (righe 393-407): aggiungere `gruppo_compagnia` al `.select` e mappare `description: c.gruppo_compagnia ? \`Gruppo: ${c.gruppo_compagnia}\` : undefined` sull'opzione (sfruttando il campo già supportato da `SearchableSelect`).

2. **Modalità lettura** (riga 1662): cambiare la label `FieldRow` da `"Compagnia"` a `"Compagnia / Agenzia di rif."`.

3. **Modalità modifica** (righe 1699 e 1704):
   - `<Label>` → `Compagnia / Agenzia di rif.`
   - `placeholder` della `SearchableSelect` → `— Seleziona compagnia / agenzia —`

## Fuori scope

- Non si toccano `DuplicazionePolizzaPage.tsx` né `RinnoviPolizzaPage.tsx` in questo step (se servisse, lo facciamo come follow-up con la stessa logica).
- Nessun cambiamento di schema o di dati salvati: continua a essere salvato `compagnia_id`.

## File toccati

- `src/pages/TitoloDetail.tsx` (3 punti come sopra).
