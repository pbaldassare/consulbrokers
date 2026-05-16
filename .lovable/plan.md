## Obiettivo

Standardizzare l'uso dell'AI in tutta l'app secondo due regole:

1. **Contesto ristretto** — l'AI vede solo i dati collegati all'entità in cui ci si trova (es. dentro Cliente X → solo polizze/sinistri/pagamenti di X), filtrati dalla visibilità commerciale dell'utente loggato (Sede/Specialist/Produttore via `get_my_ufficio_id()` + RLS).
2. **Output precompilato + Salva** — qualunque cosa l'AI generi (estrazione documenti, suggerimenti) viene mostrata in un form già popolato, ogni campo modificabile, persistenza solo al click esplicito su "Salva".

Stato attuale: le RLS già filtrano per ufficio, ma il **contesto entità** non viene passato all'AI, quindi l'Assistente IA risponde "su tutto il visibile" anche dentro Cliente X. L'estrazione documenti precompila ma in alcuni punti carica dropdown globali (compagnie/sedi/rami) anziché solo quelli pertinenti.

## Fase 1 — Pattern condiviso (fondamenta)

**Tipo `AiEntityContext`** in `src/lib/ai/context.ts`:
```text
{ entityType: 'cliente'|'polizza'|'sinistro'|'trattativa'|'compagnia'|null,
  entityId: string|null,
  ufficioId: string|null,
  scopeHint: string  // testo umano: "Cliente Mario Rossi (CF ...)"
}
```

**Hook `useAiEntityContext()`** — deriva il contesto dalla rotta corrente (`useParams` + entità caricata) e dal profilo utente. Restituisce sempre anche `ufficioId` per coerenza con la visibilità commerciale.

**Componente `<AiPrefilledForm>`** — wrapper standard per form precompilati dall'AI:
- mostra badge "Precompilato da AI" sui campi popolati
- ogni campo è editabile
- pulsante "Salva" disabilitato finché non c'è almeno una modifica o conferma esplicita
- pulsante "Scarta" per ricominciare

## Fase 2 — Assistente IA globale

Modifiche a `supabase/functions/ai-assistant/index.ts` e `src/pages/AiAssistantPage.tsx`:

- Frontend invia `entity_context` insieme a `messages`.
- System prompt arricchito con: "Stai assistendo l'utente su {entityType} {scopeHint}. Quando rispondi a domande generiche, filtra sempre per quell'entità a meno che l'utente non chieda esplicitamente dati globali."
- Tool `query_database`: aggiunto helper SQL `current_entity_filter()` (commento nel system prompt che indica le clausole WHERE da usare in base al contesto, es. `WHERE cliente_anagrafica_id = '<id>'`).
- L'AI può comunque scavalcare il filtro se l'utente lo chiede ("mostrami i totali generali"), ma di default resta entity-scoped.
- Le RLS continuano a fare da rete di sicurezza (visibilità commerciale).

Apertura dell'Assistente IA dalle pagine entità (Cliente, Polizza, Sinistro): nuovo bottone "Chiedi all'AI" che apre il chat con il contesto già impostato.

## Fase 3 — Estrazione documenti (CI, Visura, Polizza, Sinistri)

`supabase/functions/extract-document-data/index.ts` + `src/components/AiDocumentScanner.tsx` + `ImportNuovaPolizzaAIDialog.tsx`:

- L'edge function riceve anche `entity_context` e lo include nel prompt: "Stai estraendo dati per il cliente X (CF ...). Se il documento contiene dati di un'altra persona, segnala il mismatch ma NON sostituire i dati cliente."
- Frontend: dopo estrazione, apre `<AiPrefilledForm>` con i campi popolati. I dropdown collegati (compagnia, sede, ramo, prodotto) vengono filtrati per pertinenza:
  - **compagnia**: lookup per nome riconosciuto, mostra le compagnie con cui la Sede dell'utente ha rapporto attivo (`compagnia_rapporti`)
  - **sede**: pre-selezionata su `get_my_ufficio_id()`
  - **ramo/sottoramo**: pre-selezionati dal testo riconosciuto; lista mostra solo i rami abilitati per quella compagnia/sede
- Niente save automatico: l'utente vede tutto, modifica, clicca Salva.

## Fase 4 — AI Bank Reconciliation

`supabase/functions/match-bank-rows/index.ts` (già scoped per `ufficio_id`):

- Sostituire il match heuristic con chiamata Lovable AI Gateway che riceve **solo** i titoli/movimenti dello stesso ufficio e dello stesso periodo (±30gg dalla data movimento), non l'intero archivio.
- Per ogni riga bancaria l'AI restituisce: `titolo_id` candidato, `score`, `motivazione` (campi strutturati via tool calling).
- UI di riconciliazione (`incrocio-bancario` page): mostra i match suggeriti in una tabella con checkbox "Conferma" per ogni riga + campo "Cambia titolo" (SearchableSelect filtrato per stesso ufficio). Nulla viene scritto su `incroci_bancari` finché l'utente non clicca "Applica selezionati".

## Sezione tecnica

- **Modello AI**: `google/gemini-3-flash-preview` per estrazione/chat default; `google/gemini-2.5-pro` solo per riconciliazione bancaria (più ragionamento, batch piccoli). Niente costi extra rispetto a oggi.
- **Edge function calls**: tutte già passano l'`Authorization` JWT dell'utente → RLS rispettata; service role usato solo dove necessario (match-bank-rows scrive su `incroci_bancari` e `log_attivita`).
- **Audit**: ogni interazione AI con persistenza loggata su `log_attivita` con `azione='ai_prefill'` o `'ai_match_confirm'` e `dettagli_json` contenente prompt context e diff applicato (per audit trail).
- **Stato `precompilato_da_ai`**: aggiungere colonna boolean opzionale su tabelle dove serve (`clienti`, `titoli`, `sinistri`) per marcare i record la cui prima versione viene dall'AI, così rimane traccia visibile in UI.

## Ordine consigliato

```text
1) Fondamenta: useAiEntityContext + <AiPrefilledForm>   (~mezza giornata)
2) Assistente IA con entity_context + bottone "Chiedi all'AI"
3) Estrazione documenti: filtri lookup pertinenti + AiPrefilledForm
4) Bank reconciliation con AI Gateway + UI di conferma
```

Posso iniziare dalla Fase 1 (fondamenta) e poi proseguire con le tre superfici in parallelo, o partire subito dall'Assistente IA se preferisci vedere prima un risultato tangibile.
## Avanzamento Fase 3 & 4

- **Fase 3 (estrazione documenti)**: `extract-document-data` accetta ora `entity_context` (`entityType`, `scopeHint`, `expectedCF`, `expectedPIVA`) e arricchisce il system prompt per privilegiare dati coerenti con l'entità corrente (il documento viene comunque trascritto fedelmente). `AiDocumentScanner` espone `entityContext` e lo inoltra. Wiring iniziale in `ClienteDetail` (carta d'identità / tessera sanitaria / visura camerale).
- **Fase 4 (matching banca)**: `match-bank-rows` mantiene il match euristico come primario; per i casi borderline (score 60–84) interroga il Lovable AI Gateway con i soli candidati dello stesso ufficio e con importo entro ±5%, in output strutturato (`kind/id/score/motivazione`). Il risultato viene loggato in `incroci_bancari.note` + `matching_metodo = "...+ai_assist"`. Stato resta `da_verificare`: nessun auto-commit, conferma manuale via `AnomalieKO`.
