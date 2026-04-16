

## Piano: Paga Rimessa alla Compagnia + Storico Rimesse

### Panoramica
1. Rinominare "Crea Rimessa" → "Paga Rimessa" con popup IBAN
2. Supporto pagamento parziale (importo editabile)
3. Aggiungere colonne `importo_pagato` e `importo_parziale` alla tabella `rimessa_premi`
4. Nuova pagina "Storico Rimesse" nella sidebar Contabilità
5. Edge function aggiornata per accettare IBAN e importo parziale

### Modifiche DB (migrazione)

```sql
ALTER TABLE rimessa_premi
  ADD COLUMN IF NOT EXISTS importo_pagato numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS note text;
```

La colonna `iban_utilizzato` e `data_pagamento_rimessa` esistono già. `importo_pagato` traccia quanto effettivamente pagato (può essere < `totale_importi` per pagamenti parziali).

### Modifiche frontend

**1. `ECCompagniaContabPage.tsx`** — Pulsante e Dialog
- Rinominare "Crea Rimessa" → "Paga Rimessa"
- Al click: aprire un Dialog con:
  - IBAN della compagnia (fetch dal campo `iban` di `compagnie`) — se presente, preselezionato
  - Input per importo da pagare (precompilato con "Da Rimettere", editabile per parziale)
  - Campo note opzionale
  - Bottone "Conferma Pagamento"
- Alla conferma: invocare edge function con `iban`, `importo_pagato`
- Dopo successo: redirect a `/contabilita/storico-rimesse`

**2. `gestione-rimessa/index.ts`** — Aggiornare azione "crea"
- Accettare `iban_utilizzato`, `importo_pagato` nel body
- Salvare nella rimessa con `stato: 'pagata'`, `data_pagamento_rimessa: oggi`
- Se `importo_pagato < totale_importi`, segnare come pagamento parziale

**3. Nuova pagina `StoricoRimessePage.tsx`**
- Tabella con tutte le rimesse create, colonne: Compagnia, Data Pagamento, IBAN, Totale, Importo Pagato, Stato, N. Titoli
- Espandibile per vedere i titoli inclusi
- Filtri per compagnia, stato, periodo
- Paginazione server-side (25 righe)

**4. `AppSidebar.tsx`** — Aggiungere voce "Storico Rimesse" dopo "E/C Compagnia"

**5. `contabilita.tsx` (routes)** — Aggiungere route `/contabilita/storico-rimesse`

### Flusso utente
1. E/C Compagnia → espande compagnia → seleziona titoli → "Paga Rimessa"
2. Dialog mostra IBAN compagnia, importo totale (editabile per parziale), note
3. Conferma → rimessa salvata con stato "pagata" + IBAN + importo pagato
4. Redirect a Storico Rimesse dove vede tutto lo storico

