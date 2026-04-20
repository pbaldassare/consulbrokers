

## Diagnosi

Il rinnovo è andato a buon fine (toast "polizza rinnovata"), ma poi il dialog/codice fa `navigate` verso `/portafoglio/titolo/{id}` — rotta che **non esiste**, infatti vediamo il 404 su quella URL.

Verifico velocemente la rotta corretta cercando nei route file.

## Cosa controllo

1. `src/App.tsx` / route files → trovare il path corretto del dettaglio titolo (probabilmente `/portafoglio/titoli/:id` o `/titoli/:id` o `/portafoglio/:id`).
2. `RinnovoTitoloDialog.tsx` → vedere la `navigate(...)` che lancia il 404.

## Fix previsto

Una sola modifica in `src/components/polizze/RinnovoTitoloDialog.tsx`: sostituire il path errato con quello reale del dettaglio titolo già usato altrove nell'app (es. dalla lista titoli).

Nessuna modifica DB, nessuna RLS, nessun nuovo file.

## File toccato

- `src/components/polizze/RinnovoTitoloDialog.tsx` (1 riga)

