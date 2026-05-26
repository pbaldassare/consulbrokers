# Rimozione campi "Riga" e "Appendice" dalle UI

I campi `titoli.riga` (default `0`) e `titoli.appendice` (default `"000"`) restano nel DB con i loro default per non rompere insert, audit, storno/sostituzione e movimenti. Tolgo solo la UI ovunque compaia.

## File da modificare

### 1. `src/pages/ImmissionePolizzaPage.tsx`
- Rimuovo gli input "Riga" e "Appendice" nella sezione Contratto (~1484-1491).
- Rimuovo gli state `riga`/`appendice` (linee 177-178).
- Nei payload insert (linee 942-943, 1031-1032) invio i default fissi `riga: 0`, `appendice: "000"`.

### 2. `src/pages/TitoloDetail.tsx`
- Rimuovo le righe "Riga"/"Appendice" dalle card Contratto view+edit (2133-2134, 2209-2213).
- Rimuovo "Riga"/"Appendice" nei box Sostituzione e Storno (3020-3024).
- Rimuovo le colonne "Riga" e "Appendice" dalla tabella Movimenti (3088-3089 + header).
- Banner sostituzione (1552): tolgo `/ riga {sostituisce_riga}`.
- Pulsante Appendici (1611): tolgo querystring `&riga=`.

### 3. `src/pages/PortafoglioCaricoPage.tsx`
- Tolgo `/ {sostituisce_riga}` dalla cella "Sostituisce" (461) e dalla `select(...)` (138).

### 4. `src/pages/AppendiciPolizzaPage.tsx`
- Rimuovo `searchParams.get("riga")` e la riga "Riga: …" nell'intestazione (39, 272). La pagina (gestione appendici contrattuali) resta invariata: NON tocco `appendici_polizza`.

## Fuori scope
- **Trattative/Quotazioni:** non contengono i campi, nulla da fare.
- **Schema DB / trigger auto-quietanza / storno:** invariati.
- **Pagina Appendici contrattuali (`appendici_polizza`):** è feature diversa, resta.
