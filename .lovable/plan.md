# Rinomina "Codice CUP" → "Codice CIG"

Il campo obbligatorio per i clienti tipo **Ente** era stato chiamato erroneamente "CUP". Va rinominato ovunque in **CIG** (etichette UI, variabili, colonna DB).

> Nota: NON tocco `DichiarativiCUPage` (è "Certificazione Unica") né i riferimenti `cig_rif` su `titoli` / `BandiPubblici` / `TitoliList` / `TitoloDetail` / `ClientePolizze` (sono già "CIG", non c'entrano).

## 1. Database (migration)

Nuova migration:
- `ALTER TABLE clienti RENAME COLUMN codice_cup TO codice_cig;`
- Aggiornare il `COMMENT ON COLUMN`: "Codice CIG (Codice Identificativo Gara) - obbligatorio per clienti tipo Ente".
- Rigenerazione automatica di `src/integrations/supabase/types.ts` (3 occorrenze `codice_cup`).

Le migration storiche già applicate (`20260429094141...`, `20260506215713...`) restano invariate per integrità storica.

## 2. Frontend — rinomina identificatori e label

### `src/components/clienti/NuovoClienteDialog.tsx`
- `codiceCup` → `codiceCig` (state, setter, init da `initialData`, reset, payload, onChange uppercase, className validation, placeholder).
- `initialData.codiceCup` → `initialData.codiceCig` (interfaccia + assegnazione).
- `payload.codice_cup` → `payload.codice_cig`.
- `missing.push("Codice CUP")` → `"Codice CIG"`.
- Label `Codice CUP *` → `Codice CIG *`. Hint testuale → "Obbligatorio per Enti".
- Commento "Pulisci CUP" → "Pulisci CIG".

### `src/components/polizze/ImportNuovaPolizzaAIDialog.tsx`
- `codiceCup` (prop) → `codiceCig`.
- `codiceCupNew` / `setCodiceCupNew` → `codiceCigNew` / `setCodiceCigNew`.
- `cupRequired` → `cigRequired` (rinomina coerente).
- Tutti i toast / label / placeholder / testi descrittivi: "CUP" → "CIG".
- Reset, validazione, costruzione payload.

### `src/components/polizze/__tests__/aiImportPrefill.test.ts`
- Rinomina campo `codiceCup` → `codiceCig` nei mock e nelle expect.
- Aggiorna i nomi dei `it(...)` ("CUP" → "CIG") e i commenti di intestazione file.

### `src/pages/ImmissionePolizzaPage.tsx`
- `m.codiceCup` → `m.codiceCig` (linea 94, propagazione AI prefill).
- Commento linea 51: "Codice CUP per gli Enti" → "Codice CIG per gli Enti".
- (`cigRif` / `cig_rif` su `titoli` restano come sono — sono già CIG.)

### `src/pages/ClienteDetail.tsx`
- `codice_cup` → `codice_cig` (validation list e props del field).
- Label "Codice CUP" → "Codice CIG", errorMessage "Codice CUP obbligatorio per Ente" → "Codice CIG obbligatorio per Ente".

### `src/pages/cliente/ClienteAnagrafica.tsx`
- `{ campo: "codice_cup", label: "Codice CUP", ..., value: cliente.codice_cup }` → `codice_cig` / `"Codice CIG"` / `cliente.codice_cig`.

## 3. Memoria progetto

Aggiornare `.lovable/memory/insurance/gruppi-finanziari-tipo-soggetto.md`:
- `clienti.codice_cup` → `clienti.codice_cig`
- "Codice CUP obbligatorio" → "Codice CIG obbligatorio"

## 4. Out of scope
- `DichiarativiCUPage` (Certificazione Unica, non c'entra).
- `titoli.cig_rif`, `bandi.cig`, `TitoliList`, `TitoloDetail`, `ClientePolizze`, `BandiPubblici`, `cerca-bandi`, `ec-agenzia-pdf` — sono già "CIG" gestiti correttamente.
- Nessuna modifica a RLS o edge functions.

## Verifica
- `rg -n "codice_cup|codiceCup|Codice CUP"` deve restituire 0 risultati nei file modificati.
- Build TypeScript pulita dopo rigenerazione `types.ts`.
- Migration applicata: `SELECT codice_cig FROM clienti LIMIT 1;` ok.
