

## Decisione utente

L'utente sceglie:

1. **Opzione 2** (deduplica generale): tool guidato per trovare e gestire i duplicati anagrafica → polizze orfane
2. **Opzione 3** (fix immediato): pulizia ora del cliente "Lo Giudice Emilia Concetta" — spostare le 3 polizze dal record legacy `6e60fe40` al record pulito `746aed8c` e disattivare il duplicato

## Parte A — Fix immediato "Lo Giudice"

Esecuzione SQL una tantum (via insert tool):

1. Verifica conteggio polizze legacy → 3 attese
2. `UPDATE titoli SET cliente_anagrafica_id = '746aed8c-67fc-435e-9e88-70991ea03097' WHERE cliente_anagrafica_id = '6e60fe40-...'`
3. Spostamento di eventuali entità correlate al cliente legacy (per non perdere storico):
   - `sinistri.cliente_anagrafica_id`
   - `nominativi_cliente.cliente_id`
   - `privacy_consensi.cliente_id`
   - `documenti` con `entita_tipo='cliente'` e `entita_id` legacy
   - `trattative.cliente_id`
   - `chat_canali` contestuali con `entita_id` legacy
   - `portafoglio_incassi.cliente_id`
   - `notifiche` collegate
4. Disattivazione (non eliminazione) del record legacy: `UPDATE clienti SET attivo = false, note = COALESCE(note,'') || ' [MERGED in 746aed8c il 2026-04-20]' WHERE id = '6e60fe40-...'`
5. Verifica finale: il cliente `746aed8c` ora vede 3 polizze e il legacy non appare più nella lista clienti attivi

Niente DELETE per sicurezza (mantiene audit trail). Se in futuro l'utente vuole hard-delete dei record disattivati, lo facciamo separatamente.

## Parte B — Tool deduplica anagrafica clienti

Nuova pagina: `/archivi/clienti/deduplica` (route protetta da `RoleGuard` admin/responsabile).

### Funzionalità

**Sezione 1 — Detection automatica**
RPC `find_clienti_duplicati()` che ritorna gruppi di potenziali duplicati basati su:
- Stesso CF (Codice Fiscale) — match esatto, alta affidabilità
- Stesso (nome + cognome normalizzati) senza CF — media affidabilità
- Stessa P.IVA — alta affidabilità
- Match fuzzy ragione_sociale (Levenshtein/similarity > 0.85) — bassa affidabilità

Output per ogni gruppo:
- Lista record candidati con: id, nome completo, CF/PIVA, # polizze, # sinistri, # documenti, attivo, created_at, ultima_attività
- Suggerimento "master" (= record con più dati / più recente / attivo)
- Punteggio confidenza

**Sezione 2 — UI di merge guidato**

Tabella raggruppata per cluster. Per ogni cluster:
- Radio button "Master" (preselezionato sul suggerito)
- Checkbox "Da unire" sugli altri
- Tasto "Anteprima merge" → dialog che mostra cosa verrà spostato (counts per tipo di entità)
- Tasto "Conferma merge" → esegue la migrazione

**Sezione 3 — Edge function `merge-clienti`**

Service-role function che:
1. Verifica permessi utente (admin/responsabile)
2. Per ogni record da unire → master:
   - UPDATE cascade su tutte le tabelle figlie (10+ FK note)
   - Backup JSON del record disattivato in `clienti_merge_log` (nuova tabella)
   - SET `attivo = false`, `merged_into = <master_id>`, `merged_at = now()`, `merged_by = auth.uid()`
3. Logga su `log_attivita` con severity='warning'
4. Ritorna riepilogo: # polizze spostate, # sinistri, ecc.

### DB changes (Parte B)

- 2 colonne su `clienti`: `merged_into uuid`, `merged_at timestamptz` (nullable)
- 1 nuova tabella `clienti_merge_log` (id, cliente_master_id, cliente_legacy_id, snapshot_legacy jsonb, entita_spostate jsonb, eseguito_da, eseguito_at)
- 1 RPC `find_clienti_duplicati()` SECURITY DEFINER
- RLS su `clienti_merge_log`: SELECT solo admin/responsabile
- Filtro `WHERE attivo = true` o `merged_into IS NULL` su tutte le query lista clienti esistenti (verifica `ClientiList.tsx` e `useClienti` hook)

### Edge function

`supabase/functions/merge-clienti/index.ts`:
- Input: `{ master_id: uuid, legacy_ids: uuid[] }`
- Service role per bypassare RLS durante merge
- Transazionale (RPC interna `merge_cliente_atomico` per atomicità)

### Voce menu

In `src/components/AppSidebar.tsx` sotto "Archivi → Clienti", aggiungo voce "Deduplica" visibile solo per admin/responsabile.

## File toccati

**Parte A** (immediata):
- 1 INSERT/UPDATE SQL via insert tool (no migrazione, solo dati)

**Parte B** (deduplica generale):
- `supabase/migrations/...` — colonne `merged_into`/`merged_at`, tabella `clienti_merge_log`, RPC `find_clienti_duplicati`, RLS, RPC `merge_cliente_atomico`
- `supabase/functions/merge-clienti/index.ts` (nuova)
- `src/pages/DeduplicaClientiPage.tsx` (nuova, ~250 righe)
- `src/routes/archivi.tsx` — registrazione route
- `src/components/AppSidebar.tsx` — voce menu (~5 righe)
- `src/pages/ClientiList.tsx` — filtro per nascondere `merged_into IS NOT NULL` (~3 righe)

## Cosa NON faccio

- Niente hard-delete dei record (sempre soft-delete con audit)
- Niente merge automatico senza conferma utente
- Non tocco lo schema delle FK (nessuna ON DELETE CASCADE che potrebbe danneggiare)
- Non importo nuovi clienti, niente edit del flusso `import-clienti`

## Verifica post-fix

**Parte A**:
1. Apro `/archivi/clienti/746aed8c-…` → vedo 3 polizze
2. Cerco "Lo Giudice" nella lista clienti → vedo solo il record pulito (nome corretto)

**Parte B**:
1. Vado su `/archivi/clienti/deduplica` (come admin)
2. Vedo cluster di duplicati con conteggi polizze/sinistri
3. Seleziono master, conferma → polizze spostate, record legacy disattivato
4. Verifico che il record legacy non appaia più nella lista clienti
5. Verifico riga in `clienti_merge_log` con snapshot

