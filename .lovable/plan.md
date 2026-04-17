
## Analisi sezione "Importi"

Dalla screenshot la card mostra **due colonne speculari** (Firma / Quietanza) + valuta/cambio/pagamento + dati incasso. 18 campi totali.

### Classificazione

**🔒 Read-only (gestiti da altri moduli)**
- `incassato`, `data_incasso` → gestiti da Messa a Cassa
- `formato_elettronico`, `pag_diretto_compagnia` → flag tecnici impostati a livello prodotto/compagnia (per ora non modificabili da qui)

**✏️ Editabili — Importi FIRMA (numerici €)**
- `premio_netto_firma`
- `addizionali_firma`
- `tasse_firma`
- `premio_lordo_firma` *(auto-calcolato: netto + addizionali + tasse)*
- `provvigioni_firma`

**✏️ Editabili — Importi QUIETANZA (numerici €)**
- `premio_netto` (quietanza/rata corrente)
- `addizionali`
- `tasse`
- `premio_lordo` *(auto-calcolato: netto + addizionali + tasse)*
- `provvigioni`

**✏️ Editabili — Valuta & Pagamento**
- `valuta` → SearchableSelect (EUR, USD, GBP, CHF)
- `cambio` → Input number (default 1 se EUR)
- `indicizzata` → Switch (Sì/No)
- `rimborso` → Switch (Sì/No)

### Auto-calcoli (suggeriti, sovrascrivibili)
Quando l'utente modifica `premio_netto`, `addizionali`, o `tasse`:
- `premio_lordo` viene ricalcolato in tempo reale come `netto + addizionali + tasse`
- Stesso comportamento per la colonna Firma
- Il campo Premio Lordo resta **editabile** ma mostra un hint "calcolato" se non sovrascritto

### Validazioni (al salvataggio)
- Tutti gli importi ≥ 0 (errore bloccante)
- Warning (non bloccante) se `premio_lordo ≠ netto + addizionali + tasse` (l'utente l'ha sovrascritto manualmente)
- `cambio > 0` se valuta ≠ EUR
- Warning se `provvigioni > premio_netto` (incongruenza commerciale)

### Pattern UI
Stesso pattern di Contratto/Periodo:
- Pulsante **Modifica** in alto a destra della card Importi
- In edit mode: `Input type="number" step="0.01"` per importi, `SearchableSelect` per valuta, `Switch` per flag
- Colonne Firma e Quietanza affiancate (grid 2 colonne, come ora)
- Pulsanti **Annulla / Salva** in fondo
- Mutation `saveImportiMutation` → `UPDATE titoli` + `logAttivita` con diff
- Invalida `['titolo', id]`

### File toccato
- `src/pages/TitoloDetail.tsx` — sezione "Importi" + state `editingImporti`, `importiForm`, `saveImportiMutation`

### Lookup
- `valutaOpts`: hardcoded `[{value:"EUR", label:"EUR €"}, {value:"USD", label:"USD $"}, {value:"GBP", label:"GBP £"}, {value:"CHF", label:"CHF"}]`

### Cosa NON cambia
- `incassato` / `data_incasso` restano gestiti da Messa a Cassa (immutabili da qui per integrità contabile).
- Le provvigioni di sede/Consul calcolate da `percentuale_commerciale` (memory `policy-commission-split`) si aggiornano al refresh.
- Dettaglio Movimenti / Riparto restano per i prossimi step.

### Prossimo step (dopo l'approvazione)
**Commerciale & Provvigioni** (split % commerciale, anagrafica_commerciale_id, percentuale_commerciale, percentuale_consul) — con vincolo che la somma delle quote = 100%.
