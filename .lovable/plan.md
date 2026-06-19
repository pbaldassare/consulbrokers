## Obiettivo

Separare definitivamente **Polizza** (contratto) da **Quietanza** (rata) nel form *Nuova Polizza* e in tutta la UI. Salvataggio diretto su `polizze` + N `quietanze`, non più via `titoli`. Le rate sono editabili una per una in fase di creazione.

## Modello dati

Le tabelle già esistono e sono corrette:

- `polizze` — contratto: `numero_polizza, compagnia_id, ramo_id/gruppo_ramo_id, prodotto_nome, durata_da, durata_a, anni_durata, frazionamento, tacito_rinnovo, disdetta_mesi, regolazione, AE/specialist/produttore/split commerciale, descrizione_polizza, targa_telaio, tipo_portafoglio, premio_annuo_*` (aggregati informativi), `stato (attiva/sospesa/...)`.
- `quietanze` — rata: `polizza_id, numero_rata, numero_rate_totali, garanzia_da, garanzia_a, data_competenza, data_scadenza, premio_netto, tasse, ssn, addizionali, premio_lordo, provvigioni_firma, provvigioni_quietanza, data_messa_cassa, data_incasso, importo_incassato, stato (da_incassare/incassato/...)`.

Niente nuove migrazioni di schema. Solo logica + UI + backfill.

## Fasi

### Fase 1 — Refactor form `ImmissionePolizzaPage`

File: `src/pages/ImmissionePolizzaPage.tsx` + componenti in `src/components/polizze/`.

Layout a due sezioni nette:

**Sezione A — Polizza (contratto)**
Riusa `PolizzaSection` ridotto ai soli campi contratto:
- Numero polizza, prodotto, descrizione, compagnia + rapporto, ramo + sottoramo, tipo mandatario, risk type, targa/telaio
- AE, specialist, produttore, split commerciale (`anagrafica_commerciale_id`, `percentuale_commerciale`, `percentuale_riparto`)
- Sede (`ufficio_id`), tipo portafoglio
- **Durata**: `durata_da`, `durata_a`, `anni_durata`, `frazionamento` (Mensile/Trimestrale/Quadrimestrale/Semestrale/Annuale/Poliennale)
- Flag: tacito rinnovo, disdetta mesi, regolazione, indicizzata, no calcolo tasse, valuta/cambio
- **Rimossi da questa sezione**: garanzia da/a, premi, tasse, provvigioni, data competenza/scadenza, mora.

**Sezione B — Quietanze (rate)**
Nuovo componente `src/components/polizze/QuietanzeEditor.tsx`:
- Calcola `N` rate quando cambiano `durata_da/a` + `frazionamento` (helper esistente `src/lib/quietanzePlan.ts` → `computeQuietanzePlan`).
- **Poliennale**: trattato come "annuale ripetuta" → 1 quietanza per anno (es. 3 anni poliennale ⇒ 3 quietanze annuali). Vedi Fase 4 per l'aggiornamento helper.
- Render: una **card per ogni rata** ordinata cronologicamente, con header "Rata i/N — DD/MM/YY → DD/MM/YY".
- Ogni card è completamente editabile: `garanzia_da`, `garanzia_a`, `data_competenza`, `data_scadenza`, `premio_netto`, `tasse`, `ssn`, `addizionali`, `premio_lordo` (auto da somma componenti via trigger esistente `trg_titoli_normalizza_importi` clonato su `quietanze`), `provvigioni_firma`, `provvigioni_quietanza`.
- Pulsante "Applica importi a tutte le rate" per propagare valori della prima rata a tutte (con conferma).
- Anteprima KPI in cima: "Premio annuo totale (somma rate)" + "Provvigioni annue totali" → questi valori si scrivono come aggregati su `polizze.premio_annuo_*`.

**Submit**:
1. `INSERT INTO polizze` con tutti i campi contratto + aggregati `premio_annuo_*` calcolati dalla somma quietanze.
2. `INSERT INTO quietanze` batch (N righe) con i dati editati per ogni card. PG genera `id`, FK su `polizze.id`.
3. Il trigger esistente `tg_quietanza_sync_to_titoli` crea automaticamente le righe `titoli` legacy per retrocompatibilità portafoglio/contabilità (zero modifiche a quel flusso).
4. Disattiva il bypass del trigger legacy `tg_titolo_after_insert_crea_polizza` solo per questa pagina (impostando `app.skip_legacy_sync='on'` non serve perché non scriviamo su titoli).

### Fase 2 — Backfill quietanze mancanti

Migrazione `supabase/migrations/<ts>_backfill_quietanze_mancanti.sql`:

Per ogni polizza in `polizze` che non ha il numero atteso di quietanze (es. `ererreer` 0€ nello screenshot):

1. Calcola `N_attese` da `frazionamento` + `anni_durata` (riusa funzione `fn_rate_per_anno` esistente, estesa per poliennale = anni_durata).
2. Identifica le rate mancanti per indice (es. ha solo 1/2, manca 2/2).
3. `INSERT INTO quietanze` le mancanti con:
   - Date traslate dalla rata 1 (offset = `i-1` * mesi_frazionamento).
   - Importi clonati dalla rata esistente (preferisci `*_quietanza` se valorizzati).
   - `stato = 'da_incassare'`, `data_messa_cassa = NULL`.
4. Quadratura: count `quietanze` post = somma `N_attese` su tutte le polizze. La migration fallisce se diverge.
5. Esclude polizze in stato `annullata` / `sostituita`.

### Fase 3 — Trigger pre-gen per polizze create direttamente

Migrazione `supabase/migrations/<ts>_polizze_genera_quietanze_complete.sql`:

- Estende `fn_polizza_genera_quietanze` (già esistente) per supportare poliennale (oggi salta) → genera N annuali.
- `tg_polizza_after_insert_genera_quietanze` resta attivo come safety net: se la form Fase 1 ha già inserito le quietanze, il trigger esce (idempotente via skip su quietanze esistenti).

### Fase 4 — Helper `computeQuietanzePlan` (poliennale)

`src/lib/quietanzePlan.ts`:
- Aggiungi caso `'Poliennale'`: genera N quietanze annuali = `anni_durata`.
- Aggiorna test `src/lib/__tests__/quietanzePlan.test.ts` con i nuovi casi.

### Fase 5 — UI lista cliente / Carico (allineamento etichette)

- **`ClientiDetail` tab Polizze** (lista nello screenshot): la riga "Polizza" resta come header contratto espandibile; espandendo mostra le N quietanze (riusa `TitoloQuietanzePanel`). Il counter in alto "Polizze (4) · Quietanze (2)" diventa consistente: 4 polizze ⇒ ≥ 4 quietanze (dopo backfill).
- **Carico** (`PortafoglioCaricoPage`): il badge "Polizza" sparisce, diventa sempre "Quietanza N/M" (la view già espone i campi). Regolazioni mantengono badge "Regolazione".
- **TitoloDetail** aperto su una madre: nascondi blocco Messa a Cassa, mostra solo pannello quietanze (il titolo madre è anagrafica).

### Fase 6 — Edge cases & retrocompatibilità

- **Rinnovi**: il flusso rinnovo (`src/lib/...`) oggi clona la polizza. Aggiornarlo per: clonare `polizze` (nuovo `id`, nuovo periodo) + generare N nuove quietanze. Fuori scope se non rotto — verifica e dimentica.
- **Appendici**: invariate, agganciate a `polizze.id` (FK esistente).
- **Sospensione/annullamento**: già scritti contro `polizze` + cascade su quietanze non incassate, ok.
- **Provvigioni / E/C / rimesse**: leggono già da `quietanze` via view → invariati.

## File toccati

**Modificati**:
- `src/pages/ImmissionePolizzaPage.tsx` — separazione sezioni, nuovo submit.
- `src/components/polizze/PolizzaSection.tsx` — rimozione campi rata.
- `src/components/polizze/TitoloImportiPremiBlock.tsx` — eliminato dal form Nuova Polizza (resta usato altrove se necessario).
- `src/lib/quietanzePlan.ts` + test — supporto poliennale annuale.
- `src/pages/PortafoglioCaricoPage.tsx` — badge sempre "Quietanza N/M".
- `src/pages/TitoloDetail.tsx` — UI condizionale madre vs quietanza.
- `src/components/cliente/...` lista polizze cliente — espansione quietanze.

**Nuovi**:
- `src/components/polizze/QuietanzeEditor.tsx` — editor card-per-rata.
- `supabase/migrations/<ts>_backfill_quietanze_mancanti.sql`.
- `supabase/migrations/<ts>_polizze_genera_quietanze_poliennale.sql`.

## Verifica

1. **Form nuovo**: crea polizza annuale 1y → 1 card quietanza pre-compilata; modifico premio; salvo. DB: 1 riga `polizze` + 1 riga `quietanze` + 1 riga `titoli` (via trigger sync). Carico mostra "Quietanza 1/1".
2. Crea polizza semestrale 1y → 2 card editabili; rata 1 e rata 2 con importi diversi; salvo. DB: 1+2+2. Carico: "Quietanza 1/2" e "2/2".
3. Crea polizza poliennale 3y → 3 card annuali; salvo. DB: 1+3+3.
4. **Backfill**: polizza `ererreer` 0€ → dopo migration ha 1 quietanza 1/1. Lista cliente: counter coerente.
5. **Quadratura**: `SUM(premio_lordo)` su `quietanze` pre vs post backfill = identico (il backfill aggiunge solo rate a 0 dove mancanti, oppure clona importi esistenti).
6. Apertura polizza esistente in *Polizze del cliente* mostra le quietanze espandibili.

## Rischi

- **Medio**: il refactor del form è invasivo. Mitigazione: feature flag `useNewPolizzaForm` per A/B testing iniziale; rollback = togliere il flag.
- **Basso** sul backfill: aggiunge solo quietanze mancanti, non modifica esistenti.
- I trigger di sync `titoli ↔ polizze/quietanze` restano attivi e proteggono il flusso legacy.
