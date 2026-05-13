## Obiettivo

Nel dialog "Importa Nuova Polizza (AI)" (`src/components/polizze/ImportNuovaPolizzaAIDialog.tsx`), rendere esplicito il risultato del riconoscimento cliente: dire chiaramente se l'AI ha trovato un cliente esistente nel DB e con quale livello di certezza, oppure se nessun cliente combacia e va creato. Aggiungere un bottone "Usa cliente esistente" quando il match è forte.

## Comportamento

Dopo il parsing del PDF, oltre alla query già esistente `lookupClienti` (per CF/P.IVA esatti + fallback per nome), classificare ogni candidato con un livello di confidenza:

- **ESATTO** → CF coincide oppure P.IVA coincide con i dati estratti
- **PARZIALE** → solo nome/ragione sociale combacia (token match)
- **NESSUNO** → nessun candidato

Aggiungere anche un terzo criterio di lookup: **email contraente** (se presente nel PDF e CF/P.IVA mancanti) cercando in `clienti.email`.

## UI

Sostituire l'attuale span "N candidato/i" + badge piccolo nella sezione Cliente con un **banner di stato** ben visibile, sopra il `SearchableSelect` esistente:

- Match ESATTO (verde teal):
  - Icona `CheckCircle2` + "Cliente trovato nel database"
  - Riga di dettaglio: "Match su CF" / "Match su P.IVA" / "Match su Email"
  - Mostra `ragione_sociale — CF … — P.IVA …`
  - Bottone primario **"Usa cliente esistente"** che forza `setSelectedClienteId(candidato.id)` e disabilita la modalità "Crea nuovo"
- Match PARZIALE (ambra):
  - Icona `AlertTriangle` + "Possibile cliente esistente (match parziale sul nome)"
  - Mostra fino a 3 candidati con dettagli per scelta manuale via il select esistente
- NESSUNO (grigio/info):
  - Icona `Info` + "Nessun cliente trovato — verrà creato un nuovo cliente con i dati estratti"
  - Nessun bottone, il flusso "Nuovo cliente" resta quello attuale

Quando si clicca "Usa cliente esistente": il `SearchableSelect` resta visibile (per consentire override manuale) ma il flag `isNewCliente` diventa `false` e la sezione "Nuovo cliente" (CF/P.IVA/Indirizzo… + Gruppo Finanziario) viene nascosta come già avviene oggi quando un cliente è selezionato.

## Modifiche tecniche

File unico toccato: `src/components/polizze/ImportNuovaPolizzaAIDialog.tsx`

1. Estendere `lookupClienti` per:
   - Aggiungere ricerca per email (`email.ilike.<email>`) come terzo OR insieme a CF/P.IVA, se email presente
   - Tornare per ogni candidato anche `matchType: "cf" | "piva" | "email" | "name"` (nuova proprietà su `ClienteCand`)
2. Calcolare `matchLevel` derivato: `"esatto"` se almeno un candidato ha `matchType` ∈ {cf, piva, email}; `"parziale"` se solo `name`; `"nessuno"` se vuoto. Esporre via `useMemo`.
3. Aggiungere componente banner inline (non file nuovo) nella sezione "Cliente" intorno alla linea 597-625, sopra il `SearchableSelect`. Stili coerenti con i banner amber/teal già usati nel file (es. linee 694-712).
4. Bottone "Usa cliente esistente" appare solo quando `matchLevel === "esatto"` e `selectedClienteId !== bestMatch.id`. Al click setta lo state.
5. Logging: aggiornare le chiamate `log()` in `handleFile` per riflettere il livello (es. `log("success", "Match ESATTO su CF: …")` vs `log("warn", "Match parziale solo per nome")`).

Nessuna modifica a database, edge function, o ad altri file.

## Fuori scope

- Nessun "recupero anagrafica completa" (sovrascrittura campi PDF con dati DB): scartato dall'utente
- Nessun cambio al flusso "Crea nuovo cliente" attuale
- Nessun cambio agli altri lookup (compagnia, ramo, agenzia)
