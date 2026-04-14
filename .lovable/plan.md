

## Piano: Rimessa Premi interattiva con conferma, IBAN e storico

### Obiettivo
Rendere la tabella riepilogo cliccabile per vedere le polizze, aggiungere un pulsante "Conferma Rimessa" per ogni compagnia con selezione IBAN e data, e salvare tutto nello storico in database.

### 1. Migrazione DB — Nuovi campi su `rimessa_premi`
Aggiungere colonne per tracciare IBAN e data pagamento rimessa:
- `iban_utilizzato TEXT` — IBAN selezionato per il pagamento
- `data_pagamento_rimessa DATE` — data del pagamento alla compagnia
- `n_titoli INTEGER` — numero titoli inclusi
- `totale_provvigioni NUMERIC` — provvigioni trattenute

### 2. Espansione righe per compagnia (`RimessaList.tsx`)
- Ogni riga compagnia diventa cliccabile/espandibile
- Al click mostra la lista dei titoli messi a cassa per quella compagnia (numero_titolo, cliente, premio_lordo, provvigioni, netto)
- Ogni titolo è cliccabile e naviga a `/portafoglio/{id}`

### 3. Pulsante "Conferma Rimessa" per compagnia
- In fondo alla sezione espansa di ogni compagnia, pulsante "Conferma Rimessa"
- Al click apre un Dialog con:
  - **Data pagamento** (default: oggi)
  - **IBAN compagnia** — Select dropdown con gli IBAN dalla tabella `compagnie` (campo `iban` già presente, 768 compagnie lo hanno)
  - Riepilogo importo da rimettere
  - Pulsante "Conferma" per salvare

### 4. Logica di salvataggio
- Insert in `rimessa_premi` con: compagnia_id, totale_importi (netto da rimettere), iban_utilizzato, data_pagamento_rimessa, n_titoli, totale_provvigioni, stato = "inviata", created_by
- Insert in `rimessa_dettaglio` per ogni titolo incluso
- Log in `log_attivita`
- Invalidare queries per aggiornare riepilogo e storico

### 5. Storico rimesse (già presente, da arricchire)
- La sezione "Rimesse" in basso mostra anche IBAN e data pagamento
- Cliccando si va al dettaglio esistente (`RimessaDetail.tsx`)

### File coinvolti
- Migrazione SQL: aggiunta colonne `iban_utilizzato`, `data_pagamento_rimessa`, `n_titoli`, `totale_provvigioni` su `rimessa_premi`
- `src/pages/RimessaList.tsx` — righe espandibili, dialog conferma, dropdown IBAN, salvataggio

