## Obiettivo

Allineare il flusso "Importa da PDF (AI)" alla logica del manuale, rispettando due vincoli che hai ribadito:

1. **Cliente già noto** → siamo dentro l'anagrafica cliente (`?clienteId=...`), quindi niente sezione "Cliente" nel dialog.
2. **Ramo come contesto, Sottorami dal PDF** → nello step Setup si sceglie SOLO il **Gruppo Ramo** (es. `ZQ - R.C.A.`). I **sottorami** li estrae l'AI dal PDF, voce per voce, esattamente come avviene quando l'utente nel manuale aggiunge le righe in `PremiGaranziaCardShell` scegliendo il sottoramo riga per riga.

Nessun campo inventato. Nessuna deviazione dalla struttura del form manuale.

---

## Modifiche

### 1. `src/components/polizze/ImportNuovaPolizzaAIDialog.tsx`

**Step "Setup" (prima dell'upload PDF)**
- Mostrare SOLO il selettore **Gruppo Ramo** (obbligatorio). Rimuovere il selettore "Sottoramo" da questo step — non ha senso sceglierne uno globale, perché ogni riga garanzia avrà il suo.
- Helper text aggiornato: "Seleziona il Ramo: l'AI riceverà l'elenco dei sottorami ammessi per quel Ramo e mapperà ogni voce di garanzia del PDF al sottoramo corretto."
- Dropzone PDF disabilitata finché `selectedGruppoRamoId` è vuoto.

**Cliente locked (da URL)**
- Quando `lockedClienteId` è valorizzato (sempre nel caso `/portafoglio/immissione?clienteId=...`):
  - Skip `lookupClienti` nella chiamata edge function (non serve scoring/matching).
  - Nello step "review" mostrare un badge read-only "Cliente: {lockedClienteLabel} — preso dall'anagrafica corrente". Nessuna card "Cliente match", nessun campo modificabile.
  - `buildResult()` restituisce `{ cliente: { id: lockedClienteId, label: lockedClienteLabel, isNewCliente: false } }`.
  - `canProceed`/`apply()` non controllano più il cliente.

**Review step**
- Resta com'è dopo l'ultimo giro: niente sezione "Garanzie" inventata con Descrizione/Massimale. Solo preview read-only delle righe estratte (Sottoramo + Premio netto + Imposte) per dare visibilità all'utente prima dell'Applica.

**Chiamata edge function (`handleFile`)**
- Body invariato rispetto all'ultimo giro: invia `gruppo_ramo: { id, codice, descrizione }` + `sottorami_ammessi: [{ id, codice, descrizione }]` filtrati per quel Gruppo Ramo. L'AI userà SOLO quella lista per popolare `codice_sottoramo` di ogni voce.

### 2. `supabase/functions/parse-polizza-completa/index.ts`

Già aggiornato nell'iterazione precedente. Verifica solo che:
- Lo schema JSON output per ogni `voci_garanzia` includa `codice_sottoramo` (string|null) + `premio_netto` + `premio_imposte` + `aliquota_tasse_pct`.
- Il system prompt istruisca chiaramente: "Mappa `codice_sottoramo` ESCLUSIVAMENTE scegliendo dalla lista `sottorami_ammessi` fornita. Se nessuno è applicabile, lascia null e l'utente sceglierà manualmente nel form."
- **Nessun campo `massimale`** nello schema.

### 3. `src/pages/ImmissionePolizzaPage.tsx`

- Passare `lockedClienteId={clienteIdFromUrl}` e `lockedClienteLabel={clienteCorrente?.nome_completo}` al dialog.
- In `handleAIImportApply`:
  - Pre-popolare `gruppoRamoId` dal valore scelto nello step Setup.
  - Mappare `m.data.garanzie[]` in righe di `premiFirmaRows` (struttura `GaranziaRow` esistente). Per ogni voce:
    - cerca nel `ramiList` (catalogo già filtrato per `gruppoRamoId`) il record con `codice === voce.codice_sottoramo` → se trovato, `sottoramoId = riga.id`; altrimenti `sottoramoId = ""` (l'utente sceglie dal `SearchableSelect` di riga, identico al manuale).
    - `descrizione = voce.descrizione`, `premioNetto = voce.premio_netto`, `imposte = voce.premio_imposte`, `aliquota = voce.aliquota_tasse_pct`.
  - Nessun campo `massimale`. Nessuna riga "libera" inventata.

---

## Cosa NON cambia

- Schema DB, RLS, migrazioni: zero modifiche.
- Form manuale (`ImmissionePolizzaPage` + `PremiGaranziaCardShell`): struttura invariata, solo prefill via `handleAIImportApply`.
- Logica edge function core (parsing PDF, AI call): invariata, solo input/output schema arricchiti come sopra.

---

## Verifica

1. Da `/clienti/{id}` → "Nuova Polizza" → URL `/portafoglio/immissione?clienteId=...` → click "Importa da PDF (AI)".
2. Step Setup mostra **solo** "Ramo" (no Sottoramo, no Cliente). Dropzone disabilitata finché Ramo vuoto.
3. Seleziono `ZQ - R.C.A.` → dropzone si abilita → carico PDF.
4. Review step mostra: badge Cliente read-only · Compagnia/Agenzia · Ramo (ZQ) · Polizza · Premio Firma · Premio Quietanza · Targa · tabella preview Sottorami estratti dal PDF (read-only).
5. Click "Applica" → form pre-compilato; `PremiGaranziaCardShell` ha N righe, una per ogni voce del PDF, con sottoramo già selezionato dove l'AI ha trovato match nel catalogo `ZQ`, e vuoto (selezionabile dall'utente) dove non l'ha trovato.
6. Zero regressione: aprire `/portafoglio/immissione` SENZA `clienteId` mostra di nuovo la sezione Cliente completa nel dialog.
