
## Richiesta

Sui **rinnovi futuri** (titoli con `data_decorrenza_rinnovo` futura, non ancora messi a cassa) devono essere disponibili — **prima della messa a cassa** — le stesse operazioni di lifecycle già previste per le polizze in essere:

- **Sospensione**
- **Riattivazione**
- **Annullamento / Storno**
- **Appendici** (variazioni)
- **Duplicazione**
- (eventuali altre operazioni di gestione del titolo)

Oggi nella pagina del titolo (TitoloDetail) queste operazioni sono visibili/abilitate solo per polizze attive in essere; sui rinnovi futuri non lo sono. L'utente vuole che la pagina **TitoloDetail** esponga tutte queste azioni anche per i rinnovi futuri (stato `attivo`, `data_messa_cassa IS NULL`, `data_decorrenza_rinnovo > today`).

## Investigazione necessaria

Per produrre un piano preciso devo verificare:

1. **`src/pages/TitoloDetail.tsx`** — quali pulsanti/azioni esistono oggi, con quali condizioni di visibilità (probabilmente legate a `t.stato`, `t.data_messa_cassa`, oppure a `data_effetto/data_scadenza` rispetto ad oggi).
2. **Pagine operazione esistenti**:
   - `SospensionePolizzaPage.tsx`
   - `RiattivazionePolizzaPage.tsx`
   - `StornoPolizzaPage.tsx`
   - `AppendiciPolizzaPage.tsx`
   - `DuplicazionePolizzaPage.tsx`
   Per capire se accettano già un titolo "futuro" o se filtrano via `stato`/`data_decorrenza`.
3. **Tabella `titoli`** — campi: `stato`, `data_messa_cassa`, `data_decorrenza_rinnovo`, `data_effetto`, `data_scadenza`, eventuale flag `is_rinnovo_futuro` o discriminante `tipo_movimento` (PI/PQ/AM).
4. **Memory** `policy-lifecycle-operations` e `policy-lifecycle-movements` per non rompere la semantica esistente dei movimenti.

## Piano

### File principalmente toccati

- `src/pages/TitoloDetail.tsx` — esporre azioni di lifecycle anche per rinnovi futuri non ancora messi a cassa.
- (eventuale) `src/pages/SospensionePolizzaPage.tsx`, `RiattivazionePolizzaPage.tsx`, `StornoPolizzaPage.tsx`, `AppendiciPolizzaPage.tsx`, `DuplicazionePolizzaPage.tsx` — rimuovere eventuali filtri che escludono i rinnovi futuri dalla lista titoli selezionabili.

### Logica nuova in TitoloDetail

1. Definire un helper:
   ```ts
   const isRinnovoFuturo =
     t.stato === "attivo" &&
     !t.data_messa_cassa &&
     t.data_decorrenza_rinnovo &&
     new Date(t.data_decorrenza_rinnovo) > new Date();

   const isPolizzaInEssere =
     t.stato === "attivo" &&
     t.data_effetto && new Date(t.data_effetto) <= new Date() &&
     t.data_scadenza && new Date(t.data_scadenza) >= new Date();

   // Operazioni lifecycle ammesse PRIMA della messa a cassa
   const canLifecycleOps = (isPolizzaInEssere || isRinnovoFuturo) && !t.data_messa_cassa;
   ```

2. Sezione **"Operazioni"** sempre visibile per `canLifecycleOps` con i pulsanti:
   - **Sospendi** → `/portafoglio/sospensione?titolo_id=...`
   - **Riattiva** → `/portafoglio/riattivazione?titolo_id=...` (visibile solo se `stato='sospeso'`)
   - **Storno / Annulla** → `/portafoglio/storno?titolo_id=...`
   - **Appendice** → `/portafoglio/appendici?titolo_id=...`
   - **Duplica** → `/portafoglio/duplicazione?titolo_id=...`

3. Mantenere il blocco **"Messa a Cassa"** già esistente (Incassa / Garantito / Annulla) con la stessa logica attuale, che convive con il blocco Operazioni.

4. Aggiungere un piccolo **badge informativo** sulla card Polizza per chiarire all'utente lo stato corrente:
   - "In essere" se `isPolizzaInEssere`
   - "Rinnovo futuro – decorrenza GG/MM/AAAA" se `isRinnovoFuturo`
   - "Messo a cassa" se `data_messa_cassa` valorizzato
   - "Sospesa" / "Scaduta" / "Annullata" in base a `stato`

### Pagine operazione

Verificare in default mode che `SospensionePolizzaPage`, `RiattivazionePolizzaPage`, `StornoPolizzaPage`, `AppendiciPolizzaPage`, `DuplicazionePolizzaPage`:
- Accettino il `titolo_id` da query param e pre-popolino il form (deep-link dal TitoloDetail).
- Non escludano i rinnovi futuri nei loro selettori interni (es. filtri `data_messa_cassa IS NOT NULL`).

Se trovo filtri restrittivi, li allargo per includere `(isPolizzaInEssere OR isRinnovoFuturo)`.

### Cosa NON cambia

- Stati DB (`attivo / sospeso / scaduto / incassato`) restano invariati.
- Logica di "Messa a Cassa" / "Annulla Messa a Cassa" già fixata nei turni precedenti resta uguale.
- Le altre dashboard/KPI restano invariate.

### Domanda di chiarimento (procedo con le scelte di default)

1. Per **Storno/Annullamento** di un rinnovo futuro non ancora incassato, vuoi che il titolo passi a stato `scaduto` (mantenendo storia) oppure venga **fisicamente eliminato** dalla lista? Default scelto: **passa a `scaduto` con `data_storno` valorizzata**, niente delete.
2. Per **Sospensione di un rinnovo futuro**, la sospensione vale dalla `data_decorrenza_rinnovo` (futura) o da oggi? Default scelto: **dalla `data_decorrenza_rinnovo`** (coerente con polizza non ancora in copertura).
