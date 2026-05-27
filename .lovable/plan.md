## 1. Limite Mora con default automatico

In `src/pages/ImmissionePolizzaPage.tsx`:

- Aggiungere stato `limiteMoraTouched` (analogo a `dataCompetenzaTouched`).
- Nel `onChange` di Limite Mora settare `limiteMoraTouched = true`.
- Nell'`useEffect` che già auto-popola `dataCompetenza` (linee 911-920), aggiungere: se `!limiteMoraTouched` e ho `dataCompetenza` (o `durataDa` come fallback) e `moraGiorni`, calcolare `limite_mora = base + moraGiorni` e settarlo.
- Anche nel `onChange` di Data Competenza, ricalcolare Limite Mora solo se `!limiteMoraTouched` (manteniamo l'attuale comportamento ma rispettiamo l'override utente).
- Quando l'utente cambia GG Mora, ricalcolare Limite Mora come oggi (override implicito).

Risultato: aprendo l'immissione, con `durataDa = oggi`, `dataCompetenza = oggi`, `moraGiorni = 15` → `limiteMora = oggi + 15` precompilato.

## 2. Spacing select garanzia

In `src/components/polizze/PremiGaranziaCardShell.tsx` (riga ~290-312):

- Allargare la colonna "Voce": header `w-[30%]` → `w-[38%]`.
- `SearchableSelect` del sottoramo: `min-w-[220px]` → `min-w-[280px]`, aggiungere `flex-1` per occupare la cella.
- Wrapper riga: `gap-2` → `gap-3` e `py-1` sulla cella per dare un po' d'aria verticale.
- Nessuna modifica logica.

## File modificati

- `src/pages/ImmissionePolizzaPage.tsx`
- `src/components/polizze/PremiGaranziaCardShell.tsx`
- `public/version.json` (bump)
