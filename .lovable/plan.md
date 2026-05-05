## Obiettivo
Quando una polizza ha `targa_telaio` valorizzata (tipico per RCA Auto e rami simili), mostrarla nelle liste portafoglio e renderla cercabile dal motore di ricerca.

## Modifiche

### 1. Visualizzazione Targa
Le pagine già selezionano `targa_telaio` dal DB, va solo renderizzata.

- **`src/pages/PortafoglioCaricoPage.tsx`**: aggiungere colonna sortable "Targa" dopo "Ramo" (header + cella). Mostra `p.targa_telaio || "—"`.
- **`src/pages/PortafoglioAttivePage.tsx`**: stessa colonna "Targa".
- **`src/pages/PortafoglioStoricoPage.tsx`**: stessa colonna "Targa".
- **`src/pages/TitoliList.tsx`**: aggiungere `<TableHead>Targa</TableHead>` (il filtro Targa esiste già).

Per non appesantire le righe non-auto, la cella mostra "—" quando vuota; la colonna resta sempre visibile (alternativa: nasconderla se nessuna riga della pagina ha targa — più complesso, non scelto).

### 2. Ricerca per Targa
Estendere le query `.or(...)` includendo `targa_telaio.ilike.%search%`:

- `PortafoglioCaricoPage.tsx` (righe 83 e 104)
- `PortafoglioAttivePage.tsx` (righe 50 e 73)
- `PortafoglioStoricoPage.tsx` (riga 53)

Aggiornare anche il placeholder dell'input di ricerca da "Cerca per n° polizza, cliente, cod…" a "Cerca per n° polizza, cliente, codice, targa…".

### 3. Note
- DB invariato (campo `titoli.targa_telaio` già esistente).
- Nessuna modifica a TitoliList per la ricerca: ha già il filtro dedicato `filtroTargaTelaio`.
- Nessuna distinzione condizionale sul ramo: se la targa è presente la mostriamo; coerente col fatto che alcune polizze non-RCA potrebbero avere targa (rimorchi, trasporti, ecc.).
