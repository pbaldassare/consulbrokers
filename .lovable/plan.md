# Fix prefill Luogo di Nascita da CF + colore hover suggerimenti Maps

## 1) Luogo di Nascita non si prefilla dal CF

In `NuovoClienteDialog.tsx` (cliente Privato) il prefill esiste già, ma è gated da `if (!luogoNascita)` (e idem `!comuneNascita` / `!provinciaNascita`). Il valore letto è quello di chiusura al momento del render: se l'utente apre il dialog con qualunque valore preesistente, o se il campo è già stato toccato da uno scan AI, il prefill non scatta. Inoltre questo guard rende la UX inaffidabile (l'utente non capisce perché a volte funziona e a volte no).

**Cambio**: quando `parseCF(val)` ha successo e `lookupComune(codiceCatastale)` restituisce un comune, **sovrascrivere sempre** i campi derivati dal CF (sesso, data nascita, comune, provincia, luogoNascita = `"Comune (PR)"`). Il CF è la fonte di verità.

File: `src/components/clienti/NuovoClienteDialog.tsx`, blocco onChange del `FiscalCodeInput` per il privato (intorno alle righe 729-744).

## 2) Hover acquamarina sui suggerimenti Google Maps

In `AddressAutocomplete.tsx` (riga 558) i `<button>` dei suggerimenti usano `hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground` — nel tema corrente `accent` è il verde petrolio/teal del brand: l'effetto è invadente.

**Cambio richiesto dall'utente**: solo bordo sull'elemento sotto cursore/focus, senza riempire di colore. Sostituire le classi del `<button>` con uno schema "border-only":

- bg ferma su `bg-popover` (default)
- hover/focus → leggera evidenziazione neutra: `hover:bg-muted/40 focus:bg-muted/40` + `focus:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset`
- aggiungere bordo sinistro/contorno on hover via `hover:ring-1 hover:ring-border hover:ring-inset` per "bordare" la riga selezionata

Questo è l'unico componente che renderizza i suggerimenti Google Maps nel progetto (ricerca `rg` conferma: nessun altro file riusa il dropdown). Quindi il fix si applica una sola volta e copre tutti i form (clienti, polizze, compagnie, sedi, ecc.) come richiesto.

File: `src/components/AddressAutocomplete.tsx`, riga 558 (className del `<button>` dentro il dropdown predizioni).

## Out of scope
- Nessuna modifica DB.
- Nessun cambiamento al ClienteDetail (la sua logica CF è già aggressiva e funziona).
- Nessuna modifica al tema/`--accent`: si interviene solo sulle classi del componente per non alterare gli altri usi del token `accent` nel resto dell'app.
