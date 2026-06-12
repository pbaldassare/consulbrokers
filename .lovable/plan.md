## Obiettivi

1. **Step 4 wizard admin** — togliere obbligatorietà di "Responsabile Interno" (e Liquidatore).
2. **Visibilità sinistri per cliente/sede** — assicurare che i sinistri aperti da un cliente (es. Comune di Varese) compaiano sia nel suo portale sia in `/sinistri` lato admin/gestore, collegati a `cliente_anagrafica_id` e `ufficio_id`.
3. **Ciclo di vita stato pratica** — definire stati standard + workflow gestibile da admin/gestore.
4. **Auto-stato `in_valutazione`** quando un cliente apre il sinistro dal portale.
5. **Audit log** completo su ogni cambio di stato e su ogni movimento principale.

## Stati pratica (standard)

`in_valutazione` → `aperto` → `in_lavorazione` → `in_attesa_documenti` → `in_liquidazione` → `chiuso` · `respinto`

- Default da portale cliente: `in_valutazione`
- Default da wizard admin: `aperto`
- Solo admin / ruoli L2–L4 (cfo, ufficio, backoffice, manager) possono cambiare stato; cliente vede solo lettura.

## Modifiche

### 1. Wizard admin (`src/pages/SinistroAperturaWizardPage.tsx`)
- Schema zod: `responsabile_id` e `liquidatore_id` → `.optional()`.
- Step 4 UI: rimuovere asterisco e label "obbligatorio"; aggiornare descrizione step.
- `handleSubmit`: passare `null` se vuoti; `stato: 'aperto'`.

### 2. Apertura da portale cliente (`src/components/cliente/NuovaDenunciaSinistroDialog.tsx`)
- Insert con `stato: 'in_valutazione'`, `aperto_da_cliente: true`, `cliente_anagrafica_id` = id cliente corrente, `ufficio_id` derivato dal cliente (lookup `clienti.ufficio_id` se presente, altrimenti dalla polizza/titolo).
- Notifica sede + log attività (`logAttivita` con azione `sinistro_aperto_da_cliente`).

### 3. Backfill collegamenti mancanti (migration)
- `UPDATE sinistri SET cliente_anagrafica_id = t.cliente_id, ufficio_id = COALESCE(sinistri.ufficio_id, t.ufficio_id) FROM titoli t WHERE sinistri.titolo_id = t.id AND sinistri.cliente_anagrafica_id IS NULL;`
- Trigger BEFORE INSERT/UPDATE su `sinistri`: se `cliente_anagrafica_id` o `ufficio_id` nulli ma `titolo_id` presente, auto-popola da `titoli`.

### 4. Gestione stato lato admin (`src/pages/SinistroDetail.tsx` + `src/pages/SinistriList.tsx`)
- In `SinistroDetail`: header con `Select` "Stato pratica" (visibile solo se `isAdmin` o ruolo gestore). Al cambio:
  - `UPDATE sinistri SET stato = ?, data_chiusura = (CASE WHEN ?='chiuso' THEN now() ELSE null END)`
  - Inserisce riga in `sinistro_eventi` (tipo `cambio_stato`, descrizione `da X a Y`).
  - `logAttivita({ azione: 'sinistro_cambio_stato', entita_tipo: 'sinistro', dettagli_json: { da, a } })`.
  - Notifica cliente + responsabile via `notifiche`.
- In `SinistriList`: filtro stato già esistente — aggiungere i nuovi valori e badge colorato.

### 5. Portale cliente (`src/pages/cliente/ClienteSinistri.tsx`)
- Mappa badge per i nuovi stati (`in_valutazione` arancione, `in_liquidazione` viola).
- Read-only sullo stato (già).

### 6. Logging trasversale
- Centralizzare in helper `src/lib/logSinistro.ts` (apertura, cambio stato, assegnazione, liquidazione, chiusura) usando `logAttivita` + insert su `sinistro_eventi`.

## Dettagli tecnici

- Tabella `sinistri` esistente: `stato text`, `aperto_da_cliente boolean`, `ufficio_id`, `cliente_anagrafica_id` — nessun nuovo campo necessario.
- RLS: policy `sede_scope_sinistri` (`ufficio_id = ANY get_my_ufficio_ids()`) già copre la visibilità per sede una volta valorizzato `ufficio_id` → il backfill è la chiave per vedere i sinistri di Varese.
- Policy cliente: insert già consentito; la lettura cross-cliente resta vincolata a `get_my_cliente_ids()`.
- `sinistro_eventi` già presente in schema (verifico struttura in build mode prima dell'insert).

## Fuori scope

- Modifica RLS / ruoli.
- Refactor wizard oltre allo step 4.
- Modifica logica liquidazione importi.
