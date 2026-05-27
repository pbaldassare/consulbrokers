# Piano: mostrare nome+cognome AE/Produttore invece di "ragione_sociale"

## Problema

L'anagrafica AE associata al cliente ha: `nome="iole"`, `cognome="tallina"`, `ragione_sociale="232323"` (numero usato come codice/ragione sociale di fatto). L'attuale fallback nelle label dà priorità a `ragione_sociale`, quindi vediamo "232323" al posto di "tallina iole".

## Fix

Cambiare l'ordine di priorità per la label in entrambe le select AE e Produttore (file `src/pages/ClienteDetail.tsx`, blocchi `aeOptions` e `produttoreOptions`):

Nuovo ordine:
1. `cognome + nome` se almeno uno è valorizzato
2. `ragione_sociale`
3. `sigla`
4. `codice`
5. `—`

Stessa logica viene applicata anche agli hook canonici per coerenza in tutta l'app:
- `src/hooks/useAccountExecutivesLookup.ts`
- `src/hooks/useProduttoriLookup.ts`

Così Iole Tallina appare come "Tallina Iole", e le anagrafiche aziendali senza persona continuano a mostrare la ragione sociale.

## File toccati

- `src/pages/ClienteDetail.tsx` — riordino fallback in `aeOptions`/`produttoreOptions`.
- `src/hooks/useAccountExecutivesLookup.ts` — stesso riordino.
- `src/hooks/useProduttoriLookup.ts` — stesso riordino.
- `public/version.json` — bump.
