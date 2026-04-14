

## Piano: Messa a Cassa nel Carico del Mese

### Obiettivo
Aggiungere per ogni polizza nel Carico del Mese tre campi data editabili (Messa a Cassa, Pagamento, Decorrenza), pre-compilati con la data odierna, con salvataggio su database. Pulsante "Metti a Cassa" sia per singola riga che massivo.

### 1. Migrazione database — nuovi campi su `titoli`
```sql
ALTER TABLE titoli ADD COLUMN data_messa_cassa date;
ALTER TABLE titoli ADD COLUMN data_pagamento date;
ALTER TABLE titoli ADD COLUMN data_decorrenza_rinnovo date;
```
Questi campi tracciano l'operazione di messa a cassa per ogni polizza.

### 2. Modifiche a `PortafoglioCaricoPage.tsx`

**Nuove colonne nella tabella:**
- **Messa a Cassa** — input date, default = oggi
- **Pagamento** — input date, default = oggi
- **Decorrenza** — input date, default = oggi
- **Azione** — pulsante "Cassa" per singola riga

**Stato locale per le date:**
- Un oggetto `dateOverrides` per tracciare le date modificate per ogni riga (chiave = titolo id)
- Se non modificato, usa la data odierna come default

**Pulsante massivo "Metti a Cassa Tutti":**
- In alto, accanto ai filtri, un pulsante che esegue la messa a cassa per tutte le polizze visibili (non ancora incassate)
- Aggiorna `stato = 'incassato'`, `data_messa_cassa`, `data_pagamento`, `data_decorrenza_rinnovo` e `data_incasso`

**Pulsante singola riga "Cassa":**
- Per ogni polizza con stato `attivo`, un pulsante nella colonna azione
- Salva le tre date + cambia stato a `incassato`
- Log attività + toast conferma

**Click sulla riga** per navigare al dettaglio resta funzionante (il pulsante Cassa usa `stopPropagation`).

### 3. Aggiornamento vista `v_portafoglio_titoli`
Se necessario, aggiungere i tre nuovi campi alla vista per renderli disponibili nelle query.

### File coinvolti
- Migrazione SQL — 3 nuove colonne + aggiornamento vista
- `src/pages/PortafoglioCaricoPage.tsx` — UI con date editabili e pulsanti
- `src/integrations/supabase/types.ts` — aggiornamento automatico

### Flusso utente
1. Apri Carico del Mese → vedi le polizze con 3 colonne date pre-compilate a oggi
2. Modifica una data se necessario
3. Click "Cassa" sulla singola riga → polizza diventa incassata con le date salvate
4. Oppure click "Metti a Cassa Tutti" → tutte le polizze attive visibili vengono incassate

