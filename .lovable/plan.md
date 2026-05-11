## Problemi visti nello screenshot

1. **Layout rotto del banner ambra**: il messaggio è renderizzato come `flex gap-2` con l'icona + testo + `<strong>` + `<em>` come *figli diretti* del flex → ogni nodo inline diventa un flex item (colonna), spezzando il testo parola-per-parola.
2. **Manca Gruppo Finanziario nel dialog AI**: l'utente deve poter scegliere il Gruppo Finanziario *qui*, nel dialog di revisione AI, così da derivare automaticamente il tipo cliente (privato/azienda/ente) prima ancora di aprire `NuovoClienteDialog`.

## Modifiche

### 1. `ImportNuovaPolizzaAIDialog.tsx` — fix layout banner
Avvolgere il testo del messaggio in un singolo `<span>` (o `<div className="flex-1">`) così il flex ha solo 2 figli: icona + blocco testo. Il testo torna a fluire normalmente.

### 2. `ImportNuovaPolizzaAIDialog.tsx` — selettore Gruppo Finanziario inline
- Caricare `gruppi_finanziari` (id, codice, nome, tipo_soggetto) via `useQuery` quando `step === "review"` e `isNewCliente`.
- Aggiungere un `SearchableSelect` "Gruppo Finanziario *" subito sopra (o sotto) il banner ambra, *visibile solo quando* `isNewCliente`.
- Stato locale: `selectedGruppoFinanziarioId`.
- Quando l'utente seleziona un gruppo:
  - Mostrare un Badge "Tipo Cliente: Privato/Azienda/Ente (auto)" identico a quello del NuovoClienteDialog (coerenza UX).
  - Se `tipo_soggetto === "ente"` mostrare anche un Input "Codice CUP *" obbligatorio inline.
- Aggiornare il banner ambra: se Gruppo Finanziario (e CUP per Enti) sono compilati qui, il messaggio passa da "amber" a "teal" e dice "Tutto pronto: cliccando Applica verrà creato il nuovo cliente con questi dati."
- Bloccare il pulsante **Applica** finché Gruppo Finanziario (e CUP se Ente) non sono valorizzati, quando `isNewCliente`.

### 3. `MatchResult` esteso
Aggiungere campi opzionali:
```ts
gruppoFinanziarioId?: string;
tipoCliente?: "privato" | "azienda" | "ente";
codiceCup?: string;
```

### 4. `NuovoClienteInitialData` esteso
Aggiungere:
```ts
gruppoFinanziarioId?: string;
codiceCup?: string;
```
e nel `useEffect` di prefill di `NuovoClienteDialog` impostarli (se forniti) tramite `setGruppoFinanziarioId` e `setCodiceCup`. Il tipo cliente viene già derivato automaticamente dal gruppo finanziario tramite il listener esistente — basterà chiamare il `setTipoCliente` direttamente con `initialData.tipoCliente`.

### 5. `ImmissionePolizzaPage.handleAIImportApply`
Passare `gruppoFinanziarioId`, `codiceCup` (e `tipoCliente` se presente) a `aiClientePrefill` quando arrivano da `MatchResult`. La validazione blocco-Salva nel NuovoClienteDialog già esistente diventerà automaticamente "verde" all'apertura, evitando friction.

## Test
- Aggiungere caso a `aiImportPrefill.test.ts`: con `gruppoFinanziarioId` + `tipoCliente: "ente"` + `codiceCup` nel `MatchResult`, il prefill costruito li riporta tutti correttamente.
- Aggiungere test che verifica `canApply === false` quando `isNewCliente && !gruppoFinanziarioId`.

## Out of scope
- Refactor visivo del NuovoClienteDialog (l'integrazione resta invariata — riceve solo più campi via initialData).
- Caricamento di "Gruppo Statistico" o altri lookup nel dialog AI.
