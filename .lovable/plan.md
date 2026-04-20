

L'utente vuole migliorare l'AI Assistant per gestire query più complesse con maggiore accesso ai dati. Lo screenshot mostra che l'AI ha fallito una query semplice ("quante trattative ho aperte?") perché manca il contesto sullo schema della tabella `trattative` (campo `responsabile_id` non esiste).

Esploro lo stato attuale dell'AI assistant.
<lov-tool-use id="toolu_vrtx_01Ld1veWSErAb6gssnG2196P" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/ai-assistant/index.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01ViqbKvBU8u8zhWi5h4SghW" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/ai-assistant/schema-context.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_016dpmhWPwEuR9CNCRbL2GFQ" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/AiAssistantPage.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01BiAzbps3ShdbiU5crKBtna" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/ai-assistant/index.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01YLPds4JSPVU2L694Vnry8F" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/ai-assistant/schema-context.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01NqM5qhpSVBUAx4RYfHTGJq" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/AiAssistantPage.tsx\"}">
</lov-tool-use>
Ho il contesto sufficiente. Lo screenshot mostra che l'IA ha fallito perché ha cercato `responsabile_id` su `trattative` (campo che non esiste, lo schema lo dichiara ma il DB non ce l'ha). Verifico velocemente lo schema reale delle tabelle chiave per arricchire il contesto.
<lov-tool-use id="toolu_vrtx_01XPDNFQC7x4P3V4n6TXy4Ag" name="code--exec" integration-id="code" data="{\"command\": \"psql -c \\\"SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='trattative' ORDER BY ordinal_position;\\\" 2>&1 | head -50\", \"user_facing_description\": \"Verifico colonne reali tabella trattative\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01VMEUhWGN2YN3GeB6sthjgT" name="code--exec" integration-id="code" data="{\"command\": \"psql -c \\\"SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name;\\\" 2>&1 | head -100\", \"user_facing_description\": \"Lista tabelle reali nel DB\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Fmt5FDbAFwnexAeHQgb3SX" name="code--exec" integration-id="code" data="{\"command\": \"psql -c \\\"SELECT table_name FROM information_schema.views WHERE table_schema='public' ORDER BY table_name;\\\" 2>&1 | head -50\", \"user_facing_description\": \"Lista viste DB\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_015V1JbnfuqD9d6C2EM1bP9k" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT table_name, string_agg(column_name, ', ' ORDER BY ordinal_position) AS columns FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('trattative','sinistri','titoli','clienti','provvigioni_generate','movimenti_contabili','prospect','compagnie','rami','uffici','profiles','notifiche','appendici','pagamenti_provvigioni','rimesse','titoli_movimenti','anagrafiche_professionali','codici_commerciali','log_attivita','nominativi_cliente') GROUP BY table_name ORDER BY table_name;\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01AnApegDNrPwUSihB3j3JsR" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT table_name FROM information_schema.views WHERE table_schema='public' ORDER BY table_name;\"}">
</lov-tool-use>
Ho abbastanza informazioni. Lo schema reale di `trattative` non lo vedo (la richiesta era larga); recupero solo quello rapidamente, poi presento il piano.
<lov-tool-use id="toolu_vrtx_01Uekiz9XZJbdJieT3nLfKMJ" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='trattative' ORDER BY ordinal_position;\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01G2Xu72rW8n8BY34aerHcY8" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='sinistri' ORDER BY ordinal_position;\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01MuK63NyMPiFJ1DViphzVSs" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='v_portafoglio_titoli' ORDER BY ordinal_position;\"}">
</lov-tool-use>
Ho tutto. Ecco il piano.

<lov-plan>

## Diagnosi del problema attuale

Lo screenshot mostra che l'IA ha fallito perché ha generato `WHERE responsabile_id = ...` su `trattative`, ma nella tabella reale la colonna si chiama `assegnato_a` (campo `responsabile_id` esiste solo su `sinistri`). Lo `schema-context.ts` attuale è impreciso e troppo magro: il modello "indovina" colonne inesistenti e fallisce.

Inoltre lo schema attuale copre solo ~10 tabelle/colonne base, mentre il DB ha:
- `v_portafoglio_titoli` con ~90 colonne (durate, riparti, AE, specialist, conferimento gestito, sostituzioni…)
- `sinistri` con campi periti, liquidatori, riserve, controparti
- `trattative` con prospect/cliente/prodotto/sottoprodotto/fonte
- entità mancanti del tutto: `pagamenti_provvigioni`, `appendici`, `nominativi_cliente`, `anagrafiche_professionali`, `log_attivita`, `notifiche` con `destinatario_id`

## Cosa miglioro

### 1. Schema context riscritto e accurato (`supabase/functions/ai-assistant/schema-context.ts`)
- Allineo TUTTE le colonne ai nomi reali del DB (fix `trattative.assegnato_a`, `sinistri.responsabile_id`, `notifiche.destinatario_id`, `provvigioni_generate.tipo_destinatario`, ecc.)
- Aggiungo entità finora assenti: `pagamenti_provvigioni`, `appendici`, `nominativi_cliente`, `anagrafiche_professionali`, `log_attivita`, `rimesse`, `titoli_movimenti`, `codici_commerciali`
- Espongo i campi ricchi di `v_portafoglio_titoli`: AE, specialist, commerciale, riparto, durate, indicizzata, conferimento gestito, data_messa_cassa
- Aggiungo sezione "ALIASES UI → DB" (Sede=ufficio, Specialist=backoffice, Consul=produttore agenzia, AE=account executive)
- Aggiungo 12 esempi di query reali (portafoglio per AE, sinistri aperti con riserva, top clienti per premio, scadenze RCA prossimi 30gg, provvigioni pagate vs maturate, trattative per stato, polizze sospese da riattivare, ecc.)
- Aggiungo glossario stati (`titoli.stato`, `sinistri.stato`, `trattative.stato`)

### 2. Edge function più robusta (`supabase/functions/ai-assistant/index.ts`)
- Alzo il limite da 3 a **6 round-trip tool calls** (query complesse spesso richiedono prima esplorazione, poi join)
- Alzo limite righe restituite da 50 a **100** (utile per liste polizze)
- Aggiungo un **secondo tool `describe_table`** che restituisce le colonne reali di una tabella su richiesta: il modello, in caso di dubbio, lo invoca prima di generare SQL → elimina errori "colonna inesistente"
- In caso di errore SQL, **rimando l'errore al modello** così riprova (già fatto, ma miglioro il messaggio per suggerire `describe_table`)
- Logging più dettagliato delle tool call (durata ms)

### 3. Prompt di sistema potenziato
- Istruzione esplicita: "Se non sei sicuro del nome di una colonna, chiama prima `describe_table`"
- Istruzione: "Per domande aggregate (totali, conteggi) usa SUM/COUNT/GROUP BY invece di ritornare righe grezze"
- Istruzione: "Se la prima query non torna risultati, prova varianti (ILIKE più larghi, range date allargati) prima di rispondere 'nessun dato'"

## File toccati

**Modificati:**
- `supabase/functions/ai-assistant/schema-context.ts` — schema completo e accurato
- `supabase/functions/ai-assistant/index.ts` — nuovo tool `describe_table`, max 6 iterazioni, prompt potenziato

**Nessuna modifica a:**
- `AiAssistantPage.tsx` (UI invariata)
- DB / migrations (la RPC `ai_exec_select` esiste già ed è SECURITY INVOKER → continua a rispettare RLS)

## Sicurezza

Resta invariata: tutte le query passano da `ai_exec_select` (solo SELECT, RLS attive con sessione utente). Il nuovo tool `describe_table` espone solo metadati di colonne — nessun dato sensibile.

## Note

Dopo questa iterazione l'IA dovrebbe:
- Rispondere correttamente a "quante trattative ho aperte?" (userà `assegnato_a` invece di `responsabile_id`)
- Gestire query multi-step ("polizze RCA in scadenza del cliente X con la loro provvigione")
- Aggregare correttamente ("premi totali per compagnia di questo trimestre")
- Evitare errori di colonna grazie al fallback `describe_table`

