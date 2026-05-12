# Fix campi Compagnia/Agenzia/Ramo nel dialog "Importa polizza da PDF (AI)"

## Problema
Nel dialog di import AI la sezione "Compagnia & Ramo" mostra:
- un solo campo **Compagnia** che in realtà è l'agenzia (`compagnie.id`),
- un solo campo **Ramo** combinato (gruppo + sottoramo).

L'utente vuole quattro campi correttamente nidificati e salvati nel DB:
1. **Compagnia assicurativa** (gruppo, es. *LLOYD'S INSURANCE COMPANY S.A.*)
2. **Agenzia** (rapporto agenziale, es. *MED000 - Lloyd's Insurance Broker S.A.*) — filtrata in base alla compagnia scelta
3. **Gruppo Ramo** (es. *ZQ - R.C.A.*)
4. **Sottoramo** (es. *PI - R.C. AUTOVEICOLI*) — filtrato in base al Gruppo Ramo

## Modello dati (esistente, niente migrazioni)
- `gruppi_compagnia (id, codice, descrizione)` → la "Compagnia assicurativa"
- `compagnie (id, codice, nome, gruppo_compagnia_id)` → l'"Agenzia/Rapporto"
- `gruppi_ramo` → "Ramo", `rami (gruppo_ramo_id)` → "Sottoramo"
- `titoli.compagnia_id` continua a salvare l'agenzia; il gruppo si deriva via JOIN
- `titoli.ramo_id` salva il sottoramo (Gruppo Ramo derivato via JOIN — convenzione già in uso)

Nessuna modifica allo schema DB.

## Modifiche

### 1) `src/components/polizze/ImportNuovaPolizzaAIDialog.tsx`

**Tipi**
- Estendere `MatchResult`:
  ```ts
  gruppoCompagnia?: { id: string; label: string } | null;
  compagnia?: { id: string; label: string } | null; // = agenzia
  ramo?: { gruppoRamoId: string; ramoId: string; label: string } | null;
  ```

**Stato nuovo**
- `selectedGruppoCompagniaId`, `agenziaCandidates`, `selectedAgenziaId`
- `selectedGruppoRamoId`, `selectedSottoramoId` (al posto di `selectedRamoKey`)

**Lookup AI (estensione esistente)**
- `lookupCompagnie(d)` → adesso restituisce candidati di **gruppi_compagnia**: query su `gruppi_compagnia` con `descrizione ilike %token%` sul testo `d.compagnia` (il PDF contiene il nome del gruppo, es. "LLOYD'S INSURANCE COMPANY S.A."). Pre-seleziona il primo.
- Nuova funzione `loadAgenzieByGruppo(gruppoCompagniaId)` → query su `compagnie` filtrata per `gruppo_compagnia_id`. Pre-seleziona la prima agenzia se presente nel gruppo (oppure nessuna se ce ne sono molte, lasciando l'utente decidere).
- Mantenere `lookupRami(d)` ma:
  - usare i risultati per pre-selezionare `selectedGruppoRamoId` (e `selectedSottoramoId` se univoco), poi affidarsi a `RamoSottoramoSelect` per il resto.

**UI sezione "Compagnia & Ramo"**
Sostituire i due `SearchableSelect` attuali con un blocco a 2x2:

```
[ Compagnia assicurativa (gruppo)   ]   [ Agenzia (filtrata da compagnia) ]
[ Gruppo Ramo                       ]   [ Sottoramo (filtrato da gruppo)  ]
[ Prodotto                          ]   [ Numero Polizza                  ]
```

- Componenti: `SearchableSelect` per Compagnia/Agenzia (Agenzia disabilitato finché non c'è una Compagnia).
- Per Ramo/Sottoramo riutilizzare `RamoSottoramoSelect` già esistente:
  ```tsx
  <RamoSottoramoSelect
    gruppoRamoId={selectedGruppoRamoId}
    ramoId={selectedSottoramoId}
    onChange={({ gruppoRamoId, ramoId }) => { ... }}
  />
  ```
- Mostrare in label il valore originale dal PDF (es. `Compagnia (dal PDF: ...)`).

**Effetti**
- Quando cambia `selectedGruppoCompagniaId` → ricaricare `agenziaCandidates` e resettare `selectedAgenziaId` se incoerente.

**`buildResult`**
- Restituire `gruppoCompagnia`, `compagnia` (= agenzia selezionata), `ramo` (gruppoRamoId + ramoId).

**Validazione step**
- `canProceed` richiede: cliente ok + Compagnia + Agenzia + Sottoramo (Gruppo Ramo derivato dal sottoramo).

**Riepilogo**
- Aggiungere righe `Compagnia assicurativa`, `Agenzia`, `Gruppo Ramo`, `Sottoramo`.

### 2) `src/pages/ImmissionePolizzaPage.tsx` — `handleAIImportApply`
- Sostituire il blocco:
  ```ts
  if (m.compagnia?.id) setSelectedCompagnia(m.compagnia.id);
  if (m.ramo) { setSelectedGruppoRamoId(...); setSelectedRamo(...); }
  ```
  con:
  ```ts
  if (m.compagnia?.id) setSelectedCompagnia(m.compagnia.id); // agenzia → titoli.compagnia_id
  if (m.ramo) {
    setSelectedGruppoRamoId(m.ramo.gruppoRamoId);
    setSelectedRamo(m.ramo.ramoId); // sottoramo → titoli.ramo_id
  }
  ```
  (di fatto invariato, ma ora `m.compagnia` è davvero l'agenzia coerente con la compagnia scelta).

### 3) Nessuna modifica al backend
- Nessuna migrazione: `titoli.compagnia_id` (= agenzia) e `titoli.ramo_id` (= sottoramo) sono già le colonne corrette. Il salvataggio finale dal form principale non cambia.

## Out of scope
- Modifiche a `parse-polizza-completa` (l'AI già restituisce `compagnia` e `ramo_descrizione`).
- Aggiungere una colonna `gruppo_compagnia_id` su `titoli` (deriva via JOIN da `compagnie`).
- Refactor della label "Agenzia / Agenzia di rif." nel form principale (resta com'è).
