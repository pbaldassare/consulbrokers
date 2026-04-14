

## Piano: Migliorare la Messa a Cassa nel Carico del Mese

### Modifiche richieste

**1. Selezione multipla con checkbox**
- Rimuovere il pulsante "Metti a Cassa Tutti"
- Aggiungere una colonna checkbox a sinistra di ogni riga
- Checkbox nell'header per selezionare/deselezionare tutte le visibili
- Pulsante "Metti a Cassa Selezionati (N)" appare solo quando ci sono righe selezionate (solo attive)
- Stato `selectedIds: Set<string>` per tracciare le selezioni

**2. Revert da incassato → attivo**
- Per le righe incassate, il pulsante nella colonna Azione diventa "Annulla Incasso"
- Resetta `stato = 'attivo'`, e cancella `data_incasso`, `data_messa_cassa`, `data_pagamento`, `data_decorrenza_rinnovo`
- Funziona anche in bulk: se selezioni righe incassate, appare "Annulla Incasso Selezionati (N)"

**3. Semplificare le date**
- Rimuovere le 3 colonne separate di date input dalla tabella (troppo incasinato)
- Tenere una sola colonna "Messa a Cassa" che mostra la data se incassata
- Le 3 date vengono impostate automaticamente a oggi al momento del click su "Cassa"; se serve modificarle si fa dal dettaglio titolo

**4. Filtro incassato/non incassato**
- Aggiungere un filtro Select con opzioni: "Tutti", "Da incassare", "Incassati"
- Default: "Tutti"

**5. Colorazione righe**
- Righe incassate: sfondo giallo chiaro (`bg-yellow-50`)
- Righe attive: sfondo standard (bianco)

### File coinvolti
- `src/pages/PortafoglioCaricoPage.tsx` — riscrittura della UI

