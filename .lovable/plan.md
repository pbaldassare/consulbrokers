## Obiettivo

Allineare le tabelle delle pagine **Portafoglio → Carico, Polizze Attive, Storico Polizze** alla stessa logica di visualizzazione applicata in `ClienteDetail`:

1. **Rimuovere** la colonna **"Polizza madre"** (info già implicita nel numero polizza / appartenenza riga quietanza).
2. **Sostituire** la colonna **"Scadenza"** con due colonne separate **"Inizio Garanzia"** e **"Fine Garanzia"** (dati `garanzia_da` / `garanzia_a` già presenti nella vista `v_portafoglio_quietanze`).
3. **Mantenere** la colonna **Stato** (resta utile per il flusso di incasso / filtraggio storico).
4. **Fallback "—"** quando i valori sono null o date non valide.

Nessuna modifica a query / RPC / schema DB: i campi `garanzia_da` e `garanzia_a` sono già selezionati nelle tre query.

## Modifiche per file

### `src/pages/PortafoglioCaricoPage.tsx`
- **Header tabella** (riga ~648-671): rimuovere `<TableHead>Polizza madre</TableHead>`; sostituire `SortableHeader field="data_scadenza"` con due colonne:
  - `SortableHeader field="garanzia_da">Inizio Garanzia`
  - `SortableHeader field="garanzia_a">Fine Garanzia`
- **Riga tabella** (riga ~681-805): rimuovere la cella "Polizza madre" (blocco `{isQ && p.polizza_id ? ... : <span>—</span>}`); sostituire la cella `{fmtDate(p.data_scadenza)}` con due celle: `{fmtDate(p.garanzia_da)}` e `{fmtDate(p.garanzia_a)}`.
- **Ordinamento iniziale** (riga 49): cambiare `useState("data_scadenza")` → `useState("garanzia_a")`.
- **`orderField`** (riga 170): aggiornare la fallback per modalità `messe_cassa`: se `sortField` è `garanzia_a` o `garanzia_da` e siamo in Messe a Cassa, usare comunque `data_messa_cassa`. Soluzione semplice: `sortField === "garanzia_a" || sortField === "garanzia_da" ? "data_messa_cassa" : sortField`.
- `fmtDate` già gestisce null → "—": nessuna modifica.

### `src/pages/PortafoglioAttivePage.tsx`
- **Header tabella** (riga ~188-206): rimuovere `<TableHead>Polizza madre</TableHead>`; sostituire `<TableHead>Scadenza</TableHead>` con `<TableHead>Inizio Garanzia</TableHead>` e `<TableHead>Fine Garanzia</TableHead>`.
- **Riga tabella** (riga ~211-fine ciclo): rimuovere il blocco cella "Polizza madre"; sostituire `<TableCell>{fmtDate(p.data_scadenza)}</TableCell>` con `<TableCell>{fmtDate(p.garanzia_da)}</TableCell><TableCell>{fmtDate(p.garanzia_a)}</TableCell>`.
- `fmtDate` esistente già fa fallback "—".

### `src/pages/PortafoglioStoricoPage.tsx`
- **Header tabella** (riga ~204-224): rimuovere `<TableHead>Polizza madre</TableHead>`; sostituire `<TableHead>Scadenza</TableHead>` con `<TableHead>Inizio Garanzia</TableHead>` e `<TableHead>Fine Garanzia</TableHead>`.
- **Riga tabella**: rimuovere cella "Polizza madre"; sostituire `{fmtDate(p.data_scadenza)}` con `{fmtDate(p.garanzia_da)}` + `{fmtDate(p.garanzia_a)}`.
- Ordinamento query (riga 84) resta su `data_scadenza` (criterio interno di sort per archivio): nessun cambiamento.
- `fmtDate` già con fallback "—".

## Cose che NON cambiano

- Tabella `titoli` / vista `v_portafoglio_quietanze`.
- Logica filtri (`Mese Corrente`, `Messe a Cassa`, `Tutte`, `Tipo`, `Stato`).
- Azioni bulk (Cassa, Garantito, Annulla).
- Colonna **Stato** in tutte le pagine (rimane).
- Colonna **Messa a Cassa** su Carico (rimane).
- Colonne accessorie (Anticipo, Fraz, Lordo, AE, Specialist, Produttore, Targa, Dt. Sosp., Lim. Riatt., Attive/Passive).
- Routing dei click riga (la navigazione alla polizza madre dalle quietanze rimane accessibile via click sul numero polizza / icona).

## Risultato atteso

Nuovo ordine colonne **Carico**:
`☑ · N° Polizza · Tipo · Cliente · Anticipo · Agenzia · Garanzia · Inizio Garanzia · Fine Garanzia · Targa · Fraz · Lordo · AE · Produttore · Stato · Messa a Cassa · [azioni]`

Nuovo ordine **Attive**:
`N° Polizza · Tipo · Cliente · Anticipo · Agenzia · Garanzia · Inizio Garanzia · Fine Garanzia · Targa · Fraz · Lordo · Attive · Passive · AE · Specialist · Produttore`

Nuovo ordine **Storico**:
`N° Polizza · Tipo · Cliente · Anticipo · Agenzia · Garanzia · Inizio Garanzia · Fine Garanzia · Targa · Fraz · Lordo · Attive · Passive · AE · Stato · Dt. Sosp. · Lim. Riatt.`

Le date null/invalide vengono mostrate come `—`.