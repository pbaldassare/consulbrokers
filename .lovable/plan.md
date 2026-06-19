## Obiettivo

In *Carico* solo **Quietanze** (+ Regolazioni). Mai righe "Polizza". Anche per le annuali monorata: 1 Polizza ⇒ 1 Quietanza.

Modello target sulla tabella `titoli` (resta canonica per portafoglio/contabilità):
- **Madre** (`sostituisce_polizza IS NULL`) = anagrafica contratto. Vive in Polizze Attive / Storico. Mai in Carico. Importi azzerati, nessuna `data_messa_cassa`.
- **Quietanze figlie** (`sostituisce_polizza = numero_titolo madre`, da 1/N a N/N) = unici record incassabili. Portano premio, scadenze, `data_messa_cassa`, `data_incasso`, provvigioni.

Conferma utente: la nuova rata 1 **eredita** `data_messa_cassa`, `data_incasso`, `importo_incassato`, `stato` dalla madre (zero perdita storico).

## Stato attuale rilevante

- Esiste già `trg_genera_quietanze_su_insert_madre` che pre-genera **rate 2..N**. Va esteso per generare anche **rata 1**.
- Esistono tabelle parallele `polizze` + `quietanze` (Fase 1 modello pulito) sincronizzate via trigger da `titoli`. Le lasciamo evolvere come oggi — questo lavoro tocca solo `titoli` e le view di lettura.

## Fasi

### Fase 1 — Migrazione dati one-shot

Migrazione SQL in `supabase/migrations/<ts>_split_madre_rata1.sql`.

Per ogni titolo madre esistente (`sostituisce_polizza IS NULL`, escluso `stato='annullato'`, escluse polizze legacy `204366651`, `6131402092`, `RCM00010074404`):

1. **Snapshot di sicurezza**: `CREATE TABLE _backup_titoli_pre_split_<ts> AS SELECT * FROM titoli;` + dump FK collegate (`provvigioni_generate`, `movimenti_polizze`, `titoli_split_commerciali`, `titoli_storni`, `titoli_regolazioni`, `rimessa_dettaglio`, `pagamenti_provvigioni_righe`, `cliente_anticipi_utilizzi`, `titoli_compensazioni`).
2. **Crea record rata 1 figlio** con `INSERT INTO titoli SELECT ... FROM titoli WHERE id = madre.id` (clone), nuovo `id`, `sostituisce_polizza = madre.numero_titolo`, `numero_rata = 1`, `numero_rate_totali = N` (da frazionamento). Eredita: `premio_*`, `provvigioni_*`, `garanzia_da/a`, `data_messa_cassa`, `data_pagamento`, `data_incasso`, `importo_incassato`, `stato`, `tipo_pagamento`, `banca_pagamento`, ecc. Bypass trigger via `SET LOCAL session_replication_role = 'replica'` (o flag `app.skip_*` esistenti).
3. **Riaggancia FK** dalla madre alla nuova rata 1:
   ```sql
   UPDATE provvigioni_generate SET titolo_id = new_rata_id WHERE titolo_id = madre.id;
   UPDATE movimenti_polizze     SET titolo_id = new_rata_id WHERE titolo_id = madre.id;
   UPDATE titoli_split_commerciali ...
   UPDATE titoli_storni ...
   UPDATE titoli_regolazioni ...
   UPDATE rimessa_dettaglio ...
   UPDATE pagamenti_provvigioni_righe ...
   UPDATE cliente_anticipi_utilizzi ...
   UPDATE titoli_compensazioni ...
   ```
4. **Reset madre ad anagrafica pura**: azzera su madre `premio_*`, `provvigioni_*`, `data_messa_cassa`, `data_pagamento`, `data_incasso`, `importo_incassato`, `tipo_pagamento`, `banca_pagamento`, `numero_rata`, `numero_rate_totali`. Lascia `stato` calcolato (vedi Fase 3).
5. **Quadratura obbligatoria** (la migrazione fallisce se diverge):
   - `SELECT SUM(premio_lordo)` su quietanze pre vs post = identico.
   - `SELECT SUM(importo)` su `provvigioni_generate` invariato.
   - Count `data_messa_cassa NOT NULL` invariato (si è solo spostato dalla madre alla rata 1).

### Fase 2 — Trigger pre-generazione include rata 1

`supabase/migrations/<ts>_trg_genera_rate_include_rata1.sql`:

- Estendi `genera_quietanze_su_insert_madre` per generare le **rate 1..N** (oggi 2..N).
- Rata 1 nasce con `numero_rata = 1`, `numero_rate_totali = N`, importi e date clonati dalla madre, `stato = 'attivo'`, `data_messa_cassa = NULL`.
- Disattiva il fallback `genera_quietanza_su_messa_cassa` (non serve più: le rate esistono tutte da subito).
- Madre nasce subito con campi importo/data_messa_cassa NULL.

### Fase 3 — Stato madre derivato

Funzione `public.refresh_stato_madre(_madre_id uuid)` + trigger `AFTER INSERT/UPDATE/DELETE` su `titoli` figlie:

- `incassato` se tutte le rate `stato='incassato'`.
- `attivo` se almeno una rata attiva.
- `scaduto` se tutte scadute non incassate.
- `annullato` preservato se settato esplicitamente.

### Fase 4 — View `v_portafoglio_quietanze`

`supabase/migrations/<ts>_v_portafoglio_quietanze_solo_quietanze.sql`:

```sql
CREATE OR REPLACE VIEW v_portafoglio_quietanze AS
SELECT ...
FROM titoli t
WHERE t.sostituisce_polizza IS NOT NULL  -- solo quietanze figlie
   OR t.is_regolazione = true;            -- regolazioni restano
```

Rimuove il bisogno del filtro client `applyExcludeMadreConRate` in `PortafoglioCaricoPage.tsx`.

### Fase 5 — Frontend

**`src/pages/PortafoglioCaricoPage.tsx`**: rimuovi `applyExcludeMadreConRate` e relativo `select` dei campi `is_regolazione, numero_rata, numero_rate_totali` (la view ora li filtra). KPI/bulk Messa a Cassa funzionano già su quietanze.

**`src/pages/TitoloDetail.tsx`** + componenti `titolo/sections/*`:
- Quando il titolo aperto è una **madre** (`!isQuietanza(t)`): nascondi blocco Messa a Cassa, nascondi bottoni Incassa/Storna, mostra `TitoloQuietanzePanel` espanso di default come pannello principale. Il banner `TitoloScopeBanners` mostra "Polizza madre — vai alle quietanze per incassare".
- Quando è una **quietanza**: flusso messa a cassa invariato.
- Aggiorna `tipoLabel` in `src/lib/quietanze.ts`: la madre non è più "Polizza" incassabile in Carico, etichetta nei pannelli resta "Polizza".

**`v_portafoglio_attive` / `v_portafoglio_storico`**: verifica e, se leggono `premio_lordo` direttamente dalla madre, switcha a `SUM(premio_lordo)` aggregato sulle quietanze figlie (la madre ora è a 0).

### Fase 6 — Guard rail

- CHECK / trigger `BEFORE INSERT` su `provvigioni_generate`, `movimenti_polizze`, `rimessa_dettaglio`, `cliente_anticipi_utilizzi`, `titoli_compensazioni`, `pagamenti_provvigioni_righe`: vieta nuovi insert con `titolo_id` riferito a una madre (`sostituisce_polizza IS NULL`). Messaggio: "Operazione consentita solo su quietanze, non su polizza madre".
- Edge function `notifica-messa-cassa-agenzia`: già su quietanza, ok.
- `calcola-provvigioni`: già su quietanza, ok.

## File toccati

**Nuove migrazioni** (ordinate):
1. `<ts>_split_madre_rata1.sql` — Fase 1 (one-shot dati + quadratura + backup).
2. `<ts>_trg_genera_rate_include_rata1.sql` — Fase 2 (estende trigger pre-gen, dismette fallback).
3. `<ts>_refresh_stato_madre.sql` — Fase 3 (stato derivato).
4. `<ts>_v_portafoglio_quietanze_solo_quietanze.sql` — Fase 4 (view).
5. `<ts>_guard_no_insert_su_madre.sql` — Fase 6 (CHECK/trigger).

**Modificati**:
- `src/pages/PortafoglioCaricoPage.tsx` (rimuove filtro client).
- `src/pages/TitoloDetail.tsx` (UI condizionale madre vs quietanza).
- `src/components/titolo/sections/TitoloScopeBanners.tsx` (testo banner madre).
- Eventuali `v_portafoglio_attive` / `v_portafoglio_storico` se serve aggregazione.

**Memorie da aggiornare** dopo deploy:
- `auto-quietanza-su-messa-cassa.md` (rata 1 ora pre-generata).
- `polizza-vs-quietanza-filtering.md` (madre non più in Carico).
- Nuova `mem://insurance/madre-anagrafica-quietanza-incassabile.md`.

## Verifica

1. Pre-migrazione: `SELECT SUM(premio_lordo), SUM(importo_incassato), COUNT(*) FILTER (WHERE data_messa_cassa IS NOT NULL) FROM titoli;` → snapshot.
2. Post-migrazione: stessa query → identico al centesimo.
3. Carico: solo righe Quietanza/Regolazione, nessun badge "Polizza".
4. Polizza annuale nuova → 1 quietanza 1/1 in Carico.
5. Polizza semestrale nuova → 2 quietanze (1/2, 2/2) in Carico.
6. Aprendo madre (Polizze Attive) → vedo pannello Quietanze, nessun bottone Incassa.
7. E/C cliente + rimesse + provvigioni: importi invariati pre/post.

## Rischi

**Alto**: la Fase 1 tocca `titoli` (~115 colonne, FK in 10+ tabelle). Eseguire prima in DEV con dump reale. La migrazione è in transazione singola: se quadratura fallisce → `ROLLBACK` automatico. Backup tabelle conservato per ripristino manuale.
