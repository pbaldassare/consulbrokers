## Problema
Nel flusso "Importa polizza da PDF (AI)" su `ImmissionePolizzaPage`, quando il cliente non esiste l'utente sceglie *"Crea nuovo cliente da questi dati"* nel dialog di revisione AI, ma poi `handleAIImportApply` si limita a copiare il CF nel campo "Lookup rapido". Non viene aperto `NuovoClienteDialog` con i dati estratti, quindi il **Gruppo Finanziario** (obbligatorio, da cui dipende `tipo_cliente`) e gli altri passaggi obbligatori (es. **Codice CUP** per gli Enti) non vengono gestiti dal flusso AI.

## Obiettivo
Quando l'AI rileva un cliente nuovo, aprire automaticamente `NuovoClienteDialog` pre-compilato con i dati del PDF e forzare il completamento dei campi obbligatori prima del salvataggio.

## Modifiche

### 1. `ImportNuovaPolizzaAIDialog.tsx`
- Estendere `MatchResult` con un flag `isNewCliente: boolean` (true quando l'utente ha scelto `__new__`).
- In `buildResult` includere il flag.
- Aggiornare il messaggio in giallo per riflettere che si aprirà automaticamente il form di creazione cliente.

### 2. `ImmissionePolizzaPage.tsx`
- Aggiungere stati: `nuovoClienteOpen: boolean` e `aiPrefill: NuovoClienteInitialData | null`.
- In `handleAIImportApply`, quando `m.isNewCliente`:
  - Mappare i campi `data.contraente_*` in `NuovoClienteInitialData` (nome/cognome split euristico se manca ragione sociale, CF, P.IVA, email, telefono, indirizzo, CAP, città, provincia, nazione).
  - Suggerire `tipoCliente` di default a `azienda` se è presente la P.IVA, altrimenti `privato` (l'utente potrà cambiarlo selezionando il Gruppo Finanziario, che sovrascrive comunque il tipo).
  - Salvare il prefill e aprire `NuovoClienteDialog` in modalità controllata.
- Convertire l'istanza esistente di `NuovoClienteDialog` in modalità controllata (mantenendo il `trigger` per l'apertura manuale via bottone): usare `controlledOpen={nuovoClienteOpen}`, `onOpenChange={setNuovoClienteOpen}`, `initialData={aiPrefill ?? undefined}`.
- In `onCreated` resettare `aiPrefill` e selezionare il cliente appena creato.

### 3. `NuovoClienteDialog.tsx`
- La validazione `gruppoFinanziarioId` obbligatorio + `codice_cup` per ENTE è già presente (righe 385-386). Nessuna modifica funzionale richiesta.
- Verificare che `initialData` resetti correttamente lo stato a ogni apertura senza interferire con il `useEffect` del backoffice già rifattorizzato (già coperto dai test esistenti).
- Aggiungere mappatura mancante in `initialData`: `codice_fiscale_azienda` non è in `NuovoClienteInitialData`; estendere l'interfaccia con `codiceFiscaleAzienda?` per l'utilizzo dal flusso AI.

## Test
- Aggiornare/aggiungere un test in `src/components/polizze/__tests__/` (vitest) che simuli `handleAIImportApply` con `isNewCliente=true` e verifichi:
  - lo stato `nuovoClienteOpen` diventa true,
  - `aiPrefill` contiene i campi mappati attesi.
- Riusare i test backoffice esistenti per garantire che `initialData` non sovrascriva il profilo backoffice.

## Out of scope
- Logica di matching AI lato edge function.
- Modifiche al layout grafico del NuovoClienteDialog.
