

## Istruisci l'IA per lo Storico Gare

### Contesto
Il file `supabase/functions/ai-assistant/schema-context.ts` cita già `v_storico_gare` in coda (righe 328-351) ma in modo minimale: 1 esempio e nessuna guida su come distinguere il dataset di intelligence dalla pipeline `trattative`. Risultato: l'IA tende a confondere "gare" con `trattative` o a non sfruttare i campi categorizzati (broker_incumbent, categoria_ente, stato_mandato, flag_*).

### Cosa modifico

**1. `supabase/functions/ai-assistant/schema-context.ts` — sezione `v_storico_gare` espansa**
- **Spiegazione del dominio** all'inizio della sezione: chiarisce che `v_storico_gare` è *market intelligence storica PA* (chi era il broker incumbent, quando scade il mandato, condizioni di gara) e che NON va mescolata con `trattative` (pipeline commerciale attiva). Regola netta: per KPI vinte/perse correnti → `trattative`; per "chi gestiva quel comune", "broker dominanti", "mandati in scadenza" → `v_storico_gare`.
- **Glossario completo dei valori enum** già presente, lo lascio + aggiungo nota su `flag_cauzione`, `flag_referenze_bancarie`, `flag_accesso_atti`, `flag_offerta_tecnica` (booleani sui requisiti di gara) e `opzione_rinnovo_anni` (int).
- **Aggiunta delle terminologie naturali**: "comuni del Veneto", "ASL del Sud", "università", "mandati in scadenza" → `categoria_ente` + `provincia` + `stato_mandato`.
- **6-7 esempi di query nuovi**, copre i pattern più probabili:
  1. Top 10 broker incumbent per numero di mandati attivi.
  2. Mandati in scadenza nei prossimi 12 mesi gestiti da competitor (non Intermedia), con provincia/categoria.
  3. Win rate Intermedia per anno e categoria_ente.
  4. Comuni di una provincia con mandato scaduto e nessun broker incumbent dichiarato (potenziali target).
  5. Gare con tutti i flag di complessità attivi (cauzione+referenze+offerta tecnica).
  6. Distribuzione gare per `categoria_ente` ultimi 5 anni.
  7. Enti con `cliente_id IS NOT NULL` (auto-linkati al CRM) raggruppati per esito.
- **Avviso esplicito** in cima: "se l'utente dice 'gare', 'manifestazioni', 'mandati', 'broker incumbent', 'enti pubblici storici' → usa `v_storico_gare`. Se dice 'trattativa', 'pipeline', 'preventivo', 'opportunity' → usa `trattative`."

**2. `src/pages/AiAssistantPage.tsx` — suggerimenti starter**
Aggiungo 3-4 nuove voci all'array `SUGGESTIONS` (mostrate come chip nella schermata vuota), così l'utente scopre subito le capacità sullo storico gare:
- "Mandati gare in scadenza nei prossimi 12 mesi"
- "Top 10 broker incumbent nello storico gare"
- "Comuni del Veneto gestiti da competitor"
- "Win rate Intermedia per categoria ente"

### Cosa NON tocco
- Schema DB, vista `v_storico_gare`, trigger, RLS — già a posto e funzionanti.
- Logica edge function `ai-assistant/index.ts`, tool `query_database` / `describe_table`, sistema di iterazioni.
- UI della pagina `/trattative/storico-gare`.

### Verifica

1. Apri `/ai-assistant`, vedi i nuovi chip suggeriti tra cui "Top 10 broker incumbent…".
2. Chiedi: *"quanti mandati di comuni del Veneto sono in scadenza nei prossimi 12 mesi"* → l'IA esegue una query su `v_storico_gare` con `categoria_ente='comune' AND provincia IN (…) AND stato_mandato='in_scadenza_12m'` e risponde con il numero.
3. Chiedi: *"chi sono i broker più presenti nello storico"* → ritorna top per `broker_incumbent` con conteggi.
4. Chiedi: *"quante trattative aperte ho"* → continua a usare `trattative` (non `v_storico_gare`), niente regressioni.

