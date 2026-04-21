

## Allineamento `garanzia_a` con `data_scadenza` (Opzione A + safety)

### Problema
Per molti titoli legacy `garanzia_a` è disallineato rispetto a `data_scadenza` (es. titolo `d046ffeb…`: `data_scadenza = 04/04/2026` ma `garanzia_a = 30/04/2026`). Questo:
- Sposta erroneamente la polizza nel Carico del mese successivo
- Falsa il calcolo `prossima_garanzia_da/a` nella vista
- Disattiva il lock dei premi storici quando dovrebbe scattare

### Soluzione

**1. Migration di pulizia + safety**
- Crea tabella `titoli_garanzia_legacy_backup` con: `id`, `titolo_id`, `garanzia_a_old`, `garanzia_a_new`, `data_scadenza`, `motivo`, `eseguito_at`
- Snapshot di tutti i record che verranno toccati
- `UPDATE titoli SET garanzia_a = data_scadenza` dove:
  - `garanzia_a IS NOT NULL AND data_scadenza IS NOT NULL`
  - `garanzia_a > data_scadenza`
  - `garanzia_a - data_scadenza BETWEEN 1 AND 31` (solo disallineamenti tipo "fine mese")
  - Bypass del trigger `lock_premi_storici` via `SET LOCAL app.bypass_premi_lock = 'on'` (l'update non tocca premi, ma per sicurezza)

**2. Trigger `trg_align_garanzia_a` (BEFORE INSERT/UPDATE su `titoli`)**
- Se `data_scadenza IS NOT NULL`:
  - `garanzia_a IS NULL` → set `garanzia_a := data_scadenza`
  - `garanzia_a > data_scadenza + INTERVAL '3 days'` AND differenza ≤ 31 giorni → set `garanzia_a := data_scadenza` (logga in `attivita`)
- Non tocca casi anomali oltre i 31 giorni (potrebbero essere validi: appendici, prolungamenti)

**3. Vista `v_portafoglio_titoli` — difesa in profondità**
- Aggiungo colonna interna `fine_periodo_effettivo = LEAST(COALESCE(garanzia_a, data_scadenza), COALESCE(data_scadenza, garanzia_a))`
- `prossima_garanzia_da = fine_periodo_effettivo + 1 giorno`
- `prossima_garanzia_a` calcolata da `fine_periodo_effettivo` (non più da `garanzia_a` puro)
- `mese_carico = to_char(prossima_garanzia_da, 'YYYY-MM')`
- `premi_modificabili` valuta su `fine_periodo_effettivo`

**4. Diagnostica preliminare**
- Prima dell'`UPDATE`, INSERT in `titoli_garanzia_legacy_backup` con conteggio per mese impattato, così resta tracciabile

### Verifica attesa
1. Titolo `d046ffeb…`: dopo migration `garanzia_a = 04/04/2026`, `mese_carico = 2026-04` → torna nel **Carico Aprile 2026**
2. Carico Aprile 2026 mostra il numero corretto di polizze (allineato al file Excel legacy)
3. Trigger `align_garanzia_a` previene future incoerenze su import/insert manuali
4. La vista resta robusta anche se nuovi record arrivassero con date sporche
5. Backup consultabile: `SELECT * FROM titoli_garanzia_legacy_backup` per audit
6. Il trigger `lock_premi_storici` resta attivo (non viene rimosso né bypassato in modo permanente)

### File toccati
- `supabase/migrations/<new>.sql` — backup + UPDATE + trigger `align_garanzia_a` + vista aggiornata
- Nessun file frontend (la vista cambia automaticamente, le colonne esposte restano le stesse)

### Cosa NON faccio
- Non tocco `data_scadenza`, `durata_a`, `durata_da`, `garanzia_da`
- Non gestisco i casi `garanzia_a < data_scadenza` (caso opposto, raro, da analizzare separatamente)
- Non rimuovo né modifico `lock_premi_storici`, `attiva_rinnovo_su_messa_cassa`, regola legacy aprile 2026
- Non tocco i record dove la differenza `garanzia_a - data_scadenza > 31 giorni` (potrebbero essere appendici/prolungamenti legittimi)

