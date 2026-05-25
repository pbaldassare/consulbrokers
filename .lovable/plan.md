## Obiettivo

Allineare il dialog **"Importa da PDF (AI)"** al form manuale di `ImmissionePolizzaPage`:

1. **Niente sezione "Cliente"** quando si entra dall'anagrafica cliente (`?clienteId=...`).
2. **Selezione Gruppo Ramo PRIMA del caricamento PDF**, così l'AI riceve in input il catalogo dei sottorami validi e mappa le voci correttamente, senza inventare descrizioni libere o campi "Massimale".
3. **Niente sezione "Garanzie" inventata** nello step review: le voci estratte vanno direttamente nelle righe `PremiGaranziaCardShell` del manuale (Sottoramo + Netto + Tasse).

Zero campi inventati. Stessi campi del manuale.

## Nuovo flusso del dialog AI

```text
[Step 1: SETUP]               [Step 2: PARSING]            [Step 3: REVIEW]
─────────────────             ─────────────────            ─────────────────
• Cliente (badge read-only    • Spinner + log fasi         • Compagnia + Agenzia
  se locked da URL)                                        • Ramo (read-only, già scelto)
• RamoSottoramoSelect           ↓ invoca edge function     • Sottoramo (per riga premio)
  → Gruppo Ramo (obbl.)          con `gruppo_ramo_codice`  • Polizza (n°/prodotto/date/fraz/tacito)
  → Sottoramo (opzionale,        e lista sottorami         • Premio Firma  (righe Shell)
    suggerimento)                ammessi                   • Premio Quietanza (righe Shell)
• Dropzone PDF                                             • Targa (se RCA)
  (abilitata solo se
   Gruppo Ramo scelto)
```

## Modifiche

### 1. `src/components/polizze/ImportNuovaPolizzaAIDialog.tsx`

**A. Skip sezione Cliente quando da URL**
- Nuove prop: `lockedClienteId?: string`, `lockedClienteLabel?: string`.
- Se valorizzate: niente `lookupClienti`, nascondere sezione Cliente in review, badge read-only *"Cliente: {label} — preso dall'anagrafica corrente"*. `buildResult()` ritorna il cliente locked. Check rimossi da `canProceed`/`apply()`.

**B. Aggiungere Step "Setup" prima dell'upload**
- Nuovo step iniziale (prima di `upload`/`parsing`/`review`) con:
  - Badge Cliente read-only (se locked).
  - `<RamoSottoramoSelect>` (componente già esistente, usato nel manuale) per scegliere **Gruppo Ramo** obbligatorio + Sottoramo opzionale.
  - Dropzone PDF disabilitata finché Gruppo Ramo non è valorizzato (helper text: *"Seleziona prima il Gruppo Ramo per aiutare l'estrazione AI"*).
- Salvare lo stato in `selectedGruppoRamoId` / `selectedSottoramoId` **prima** del parsing.

**C. Passare il contesto Ramo all'edge function**
- Nel `supabase.functions.invoke("parse-polizza-completa", { body })` aggiungere:
  ```ts
  body: {
    fileBase64, mimeType,
    gruppo_ramo: { id, codice, descrizione },
    sottorami_ammessi: rami.filter(r => r.gruppo_ramo_id === selectedGruppoRamoId)
                            .map(r => ({ codice: r.codice, descrizione: r.descrizione }))
  }
  ```
- Saltare `lookupRami` in fase parsing: il ramo è già scelto manualmente, l'AI **non lo deve cambiare**.

**D. Rimuovere sezione "Garanzie (N)" dallo step review**
- Eliminare il blocco righe ~931–990 (Descrizione/Massimale/Premio netto): non esiste nel manuale, confonde.
- I dati grezzi `data.garanzie` (ora arricchiti con `codice_sottoramo` suggerito dall'AI grazie al contesto al punto C) restano nel payload e vengono passati a `onApply` per popolare le righe `PremiGaranziaCardShell` lato pagina.

### 2. `supabase/functions/parse-polizza-completa/index.ts`

- Accettare i nuovi campi opzionali in body: `gruppo_ramo`, `sottorami_ammessi`.
- Aggiungere alla prompt (system / user) un blocco tipo:
  > *"Il ramo della polizza è: GRUPPO {codice} – {descrizione}. Per ogni voce di garanzia/premio estratta, mappa `codice_sottoramo` SOLO scegliendo tra questo elenco di sottorami ammessi: [...]. Se non sei sicuro, lascia `codice_sottoramo` vuoto. Non inventare codici."*
- Aggiungere `codice_sottoramo` nel JSON schema di output per ogni elemento di `voci_garanzia` (in aggiunta ai campi esistenti `descrizione`, `premio_netto`, `aliquota_tasse_pct`).
- Niente modifiche al resto dello schema (compagnia, contraente, polizza, premi totali, targa restano identici).

### 3. `src/pages/ImmissionePolizzaPage.tsx`

**A. Passare cliente locked al dialog** (riga ~1010): `lockedClienteId={preselectedClienteId || undefined}` + `lockedClienteLabel` derivata da `clienteDettaglio`.

**B. Estendere `handleAIImportApply`** per mappare `m.data.garanzie[]` in **righe multiple** di `premiFirmaRows`:
- Per ogni voce: cercare in `rami` (filtrati per `gruppoRamoId` selezionato) il record con `codice == voce.codice_sottoramo` → riempire `sottoramoId`, `descrizione`, `netto`, `tasse`. Se `codice_sottoramo` manca o non matcha, riga creata vuota di `sottoramoId` (utente sceglie dal SearchableSelect di riga, come nel manuale).
- Niente "massimale" (campo non esistente nel manuale).
- Stessa mappatura per `premiQuietanzaRows` se l'AI estrae righe distinte per la quietanza; altrimenti la quietanza resta con la singola riga aggregata già gestita oggi.

## Cosa NON cambia

- DB / RLS / migrations: nessuna modifica.
- Manual form: nessuna modifica strutturale (`PremiGaranziaCardShell`, `RamoSottoramoSelect`, salvataggio polizza identici).
- Edge function: solo aggiunta di 2 campi opzionali in input + 1 campo in output; struttura JSON esistente preservata (backward compatible).
- Flusso "Immissione senza clienteId nell'URL": sezione Cliente del dialog torna visibile (regressione zero).

## Verifica

1. `/portafoglio/immissione?clienteId=<id>` → "Importa da PDF (AI)" → step **Setup**: badge Cliente, selettore Ramo+Sottoramo, dropzone disabilitata.
2. Scelgo Gruppo Ramo "AUTO" → dropzone abilitata → carico `COMUNE_DI_AGNONE_HD076XZ_2.pdf`.
3. Step Review: niente sezione Cliente, niente sezione "Garanzie (14)" con Massimale. Solo Compagnia/Agenzia/Polizza/Premio Firma/Premio Quietanza/Targa.
4. Click Applica → form Immissione pre-compilato; `RamoSottoramoSelect` già fissato; righe `PremiGaranziaCardShell` (Firma) popolate con sottoramoId mappato per ogni voce (es. RCA, Incendio, Furto, Cristalli…), netto/tasse coerenti.
5. Aprire `/portafoglio/immissione` senza `clienteId` → sezione Cliente nello step Setup torna visibile.
