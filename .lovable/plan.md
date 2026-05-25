## Obiettivo

Eliminare gli step intermedi "Revisione" e "Riepilogo" del dialog `ImportNuovaPolizzaAIDialog`. Dopo aver selezionato il Ramo e caricato il PDF, i dati estratti vengono **applicati direttamente** al form di immissione (che è già il punto di verità grafico e funzionale). Eventuali correzioni si fanno nel form stesso, esattamente come per il manuale. Nessun campo inventato, nessuna grafica parallela.

## Modifiche

### 1. `src/components/polizze/ImportNuovaPolizzaAIDialog.tsx`

- **Rimuovere** gli step `review` e `summary`. Resta solo `setup` + stato `parsing`.
- Dopo che `handleFile` riceve il `parsed` e completa i lookup automatici (cliente locked, gruppoCompagnia, agenzia, ramo già scelto):
  - Costruire direttamente `MatchResult` con `buildResult()`.
  - Chiamare `onApply(result)` e chiudere il dialog (`onOpenChange(false)` + `reset()`).
  - Toast: "Dati importati: completa/correggi nel form".
- **Auto-selezione lookup** (già presenti): mantenere la logica che pre-seleziona il primo `gruppoCompagnia` candidato e l'unica/prima agenzia. Se l'auto-selezione lascia `gruppoCompagnia` o `agenzia` vuoti, il form mostrerà i campi vuoti — l'utente li imposta lì, niente blocchi nel dialog.
- **Cliente nuovo (non locked):** caso oggi non in scope perché siamo sempre dentro l'anagrafica cliente. Se `lockedClienteId` manca, lasciare comunque l'auto-apply usando `isNewCliente=true`: la pagina `ImmissionePolizzaPage` ha già la sua gestione (apertura form nuovo cliente). Nessuno step intermedio.
- **Rimuovere** dal JSX: l'intera sezione `step === "review"` (cliente cards, banner match, premi, garanzie preview), l'intera sezione `step === "summary"`, e i pulsanti footer `Riepilogo`/`Modifica`/`Applica` (resta solo eventuale Annulla).
- **Rimuovere** componenti helper non più usati: `FieldInput`, `PremiBlock`, `SummaryRow` se non hanno altri consumer (verifica con grep).
- **Rimuovere** stati ora morti: `gruppiFinanziari`, `selectedGruppoFinanziarioId`, `codiceCigNew`, `clienteCandidates`, banner `bestMatch`/`matchLevel`. La logica `lookupClienti` resta solo se serve all'auto-apply quando non locked; altrimenti rimuoverla del tutto.
- **Tipo `Step`** ridotto a `"setup"` (o eliminato).
- **Header dialog:** rimuovere il Badge "2. Revisione / 3. Riepilogo".

### 2. `src/pages/ImmissionePolizzaPage.tsx`

Nessuna modifica funzionale al form. Solo verificare che `handleAIImportApply` (già implementato nelle iterazioni precedenti):
- Mappa correttamente `m.data.garanzie[]` → `premiFirmaRows` (sottoramo per riga via `codice_sottoramo`).
- Popola tutti gli altri campi: cliente locked, compagnia/agenzia, ramo (gruppo), prodotto, numero polizza, decorrenza/scadenza, frazionamento, tacito rinnovo, premi firma/quietanza, targa.
- Mostra un toast di conferma. Eventuali campi mancanti restano vuoti nel form (selezionabili manualmente lì).

### 3. Edge function `parse-polizza-completa`

Nessuna modifica. Lo schema output e il prompt restano quelli già allineati al manuale (con `gruppo_ramo` + `sottorami_ammessi` come contesto).

## Flusso risultante

1. `/portafoglio/immissione?clienteId=...` → click "Importa da PDF (AI)".
2. Dialog: badge Cliente (locked) + selettore Ramo + dropzone.
3. Scelgo Ramo → carico PDF → progress bar + log live.
4. Estrazione completa → **dialog si chiude da solo** → form pre-compilato con tutti i campi estratti, righe garanzia già create con sottoramo selezionato dove c'è match.
5. Eventuali campi mancanti/errati si correggono direttamente nel form (UI identica al manuale).

## Cosa NON cambia

- Schema DB, RLS, edge function, form manuale, mappatura `handleAIImportApply`.
- Tracciamento log live durante il parsing (utile per debug — resta visibile nello step setup mentre `parsing=true`).
