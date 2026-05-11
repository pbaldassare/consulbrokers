
## Obiettivo

Uniformare ovunque la selezione del ramo polizza usando due selettori coordinati:
- **Ramo** = `gruppi_ramo` (es. `ZQ - R.C.A.`)
- **Sottoramo** = `rami` filtrati per gruppo selezionato (es. `PI R.C. AUTOVEICOLI`)

Eliminare la colonna legacy `titoli.gruppo_ramo` (sempre NULL, fuorviante).

## 1. Database

Migrazione:
- `ALTER TABLE titoli DROP COLUMN gruppo_ramo;`
- Verifica viste dipendenti (`v_portafoglio_titoli` espone `gruppo_ramo` come testo derivato dal join — la teniamo perché già calcolata via join, non dipende dalla colonna eliminata; rigenerare la vista se necessario).

Nessun backfill necessario: tutti i 25 titoli hanno `ramo_id` valido e il gruppo è sempre derivabile via `rami.gruppo_ramo_id → gruppi_ramo`.

## 2. Hook condiviso

Nuovo `src/hooks/useRamiLookup.ts`:
- `useGruppiRamo()` → `[{ value: id, label: "codice - descrizione" }]`
- `useRami(gruppoRamoId?: string)` → `[{ value: id, label: "codice - descrizione", gruppo_ramo_id }]` filtrato lato client se `gruppoRamoId` valorizzato.
- Cache `staleTime` 30 min.

## 3. Componente riusabile

Nuovo `src/components/polizze/RamoSottoramoSelect.tsx`:
- Props: `gruppoRamoId`, `ramoId`, `onChange({gruppoRamoId, ramoId})`, `disabled`, `required`, `layout` (`row|stacked`).
- Rende due `SearchableSelect` affiancati, label "Ramo" / "Sottoramo".
- Logica:
  - Cambio Ramo (gruppo) → se il sottoramo corrente non appartiene al nuovo gruppo, viene resettato.
  - Cambio Sottoramo → se il gruppo è vuoto o diverso, viene auto-popolato dal `gruppo_ramo_id` del sottoramo.
  - Sottoramo è disabilitato finché il Ramo non è scelto (oppure mostra tutti i sottorami con badge gruppo se `gruppoRamoId` vuoto — opzione `freeMode`).

## 4. Form polizza (nuove + esistenti)

**`ImmissionePolizzaPage.tsx`**
- Stato attuale `selectedRamo` (= ramo_id) → aggiungere `selectedGruppoRamo`.
- Sostituire l'attuale Select "Ramo" con `<RamoSottoramoSelect>`.
- Salvataggio `titoli`: continua a scrivere solo `ramo_id` (gruppo derivato).

**`TitoloDetail.tsx` (Card Contratto, sezione modifica)**
- Sostituire il Select "Ramo" con `<RamoSottoramoSelect>` (riga 1909-1914).
- Display read-only (riga 1867): mostrare due righe — "Ramo" (gruppo) e "Sottoramo" (rami).
- Rimuovere riferimenti a `contrattoForm.gruppo_ramo` se presenti.

**`RinnovoTitoloDialog.tsx`**
- Rimuovere `gruppo_ramo: t.gruppo_ramo` (riga 205) dall'oggetto rinnovo.

## 5. Trattative

**`TrattativaDettagliTab.tsx`**
- Sostituire il `SearchableSelect` ramo (riga 167-168) con `<RamoSottoramoSelect>`.
- Salvataggio: `trattative` ha solo `ramo_id`; nessun nuovo campo.

## 6. Filtri Portafoglio / Provvigioni / Estrazioni

Pagine coinvolte (filtri ramo presenti):
- `PortafoglioAttivePage.tsx`, `PortafoglioCaricoPage.tsx`, `PortafoglioStoricoPage.tsx`
- `ProvvigioniMaturatePage.tsx`, `ProvvigioniSedePage.tsx`
- `TrattativeList.tsx`, `StoricoTrattativePage.tsx`
- `ECAgenziaPdfPage.tsx`, `ECClientePdfPage.tsx`, `ECProduttorePdfPage.tsx`
- `ClienteDetail.tsx`, `ProspectDetail.tsx`, `ClienteDashboard.tsx`

Pattern: aggiungere un `FilterSearchableSelect` "Ramo" (gruppo) **prima** dell'esistente filtro "Sottoramo". La selezione del gruppo filtra dinamicamente le opzioni del sottoramo. Le query continuano a filtrare per `ramo_id` (sottoramo); se è valorizzato solo il gruppo, si filtra `ramo_id IN (lista rami del gruppo)`.

Per evitare duplicazione, creare `src/components/polizze/RamoSottoramoFilter.tsx` (variante "filtro": entrambi opzionali, con opzione "Tutti").

## 7. Cleanup

- `src/integrations/supabase/types.ts` si rigenera dopo migration.
- Cercare e rimuovere ogni `gruppo_ramo` testuale residuo nei payload insert/update titoli.
- Memoria: aggiornare `mem://insurance/policy-financial-structure-expansion` (o creare nuova memory `ramo-sottoramo-coordinated-selection`) con la convenzione UI Ramo/Sottoramo + eliminazione colonna legacy.

## 8. QA

1. Crea polizza nuova: scegli Ramo `R.C.A.` → solo sottorami RCA disponibili. Salva e riapri: i due campi sono coerenti.
2. Apri polizza esistente, cambia Ramo (gruppo) → Sottoramo si resetta. Salva il nuovo sottoramo: la VociRcaCard si aggiorna correttamente filtrando garanzie per nuovo gruppo.
3. Filtri Portafoglio: scegli solo "Ramo R.C.A." → elenco mostra tutte le polizze di tutti i sottorami RCA. Aggiungi sottoramo → si restringe.
4. Trattativa: stesso comportamento del form polizza.
5. Verifica che VociRcaCard (che usa `useQuery titolo-gruppo-ramo`) continui a funzionare poiché basata su join, non sulla colonna eliminata.

## Tabelle/file toccati

```text
DB:    titoli (DROP COLUMN gruppo_ramo)
NEW:   src/hooks/useRamiLookup.ts
NEW:   src/components/polizze/RamoSottoramoSelect.tsx
NEW:   src/components/polizze/RamoSottoramoFilter.tsx
EDIT:  ImmissionePolizzaPage, TitoloDetail, RinnovoTitoloDialog,
       TrattativaDettagliTab, +12 pagine con filtro ramo
```
