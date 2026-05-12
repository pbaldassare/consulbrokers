## Obiettivo
Aggiungere validazione bloccante in `NuovoClienteDialog` con regole differenziate in base al `tipo_soggetto` derivato dal Gruppo Finanziario.

## Regole di obbligatorietà

### PRIVATO
- Nome
- Cognome
- Codice Fiscale (16 char)
- Indirizzo Residenza (indirizzo + CAP + Città + Provincia)
- Email

### AZIENDA
- Ragione Sociale
- Partita IVA
- Indirizzo Sede (indirizzo + CAP + Città + Provincia)
- Referente Aziendale (Nome + Cognome + Email referente)
- Email

### ENTE
- Denominazione Ente (ragione_sociale)
- Partita IVA
- Codice Fiscale Ente
- Codice CUP (già presente)
- Indirizzo Sede (indirizzo + CAP + Città + Provincia)
- Referente Ente (Nome + Cognome + Email)
- Email

### Sempre
- Gruppo Finanziario (già presente)

## Implementazione (`src/components/clienti/NuovoClienteDialog.tsx`)

1. **Helper `getMissingFields()`** dentro al componente: ritorna `string[]` con label dei campi mancanti in base a `tipoCliente`.

2. **Validazione in `createMutation.mutationFn`**: se `missing.length > 0` → `throw new Error("Campi obbligatori mancanti: ...")`. Mantiene anche i check esistenti (gruppo, CUP ente, CF privato 16 char).

3. **UI inline**:
   - Aggiungere asterisco `*` alle Label dei campi obbligatori (condizionale per tipo).
   - Bordo `border-amber-400` su Input quando il valore è vuoto e il campo è richiesto (pattern già usato per CUP).
   - Mantenere validazione visiva non invasiva (no toast spam mentre digita).

4. **Footer Salva**:
   - Estendere il calcolo `blocked` esistente: `blocked = missingGruppo || getMissingFields().length > 0`.
   - Messaggio amber sintetico: "Mancano: Nome, Cognome, …" (max 3 campi + "…").
   - Pulsante Salva disabilitato come oggi.

5. **Reset**: nessuna modifica, `resetForm` già copre tutti i campi.

## Out of scope
- Modifiche a `ClienteDetail.tsx` (modifica cliente esistente).
- Modifiche al DB / RLS.
- Validazione formato email/CF avanzata oltre a quanto già presente.
- Test automatici (se richiesti, da aggiungere come task separato).
