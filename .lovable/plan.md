# Pulizia pagina Sospensione Polizza

Solo modifiche UI a `src/pages/SospensionePolizzaPage.tsx`. Nessuna modifica alla logica di mutation, DB o filtri di lista.

## 1. Sezione Cliente
- Rimuovere il campo **A/E** (select + relativo state `selectedAE` e query `aeList`).
- Campo **Codice**: rimuovere l'icona lente (`<Search>`) — resta input read-only quando viene dal dettaglio.

## 2. Sezione Polizza
- Rimuovere il campo **Riga** (e relativo state `riga`).
- Campo **Numero**: rimuovere l'icona lente (`<Search>`).
- Restano: Data Sospensione, Limite Riattivazione, Motivo (invariati).

## 3. Popup di conferma sul pulsante "Conferma"
- Al click su **Conferma** mostrare un `AlertDialog` (shadcn) con:
  - Titolo: "Conferma sospensione polizza"
  - Testo: riepilogo breve — numero polizza, data sospensione, limite riattivazione, e avviso che verranno **eliminate le quietanze future non incassate**.
  - Pulsanti: **Annulla** / **Conferma sospensione** (variante destructive).
- Solo alla conferma del dialog parte `sospensioneMutation.mutate()`.

## File coinvolti
- `src/pages/SospensionePolizzaPage.tsx` (unica modifica)

## Fuori scope
- Nessun cambio a mutation, log, movimenti, filtri portafoglio, memorie.
