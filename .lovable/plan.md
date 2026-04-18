
## Obiettivo

Chat IA interrogabile da tutti gli utenti che risponde su qualsiasi dato (polizze, clienti, sinistri, scadenze, provvigioni, contabilità...) **rispettando RLS** — quindi un utente di Napoli vede solo dati Napoli, un cliente solo i suoi, l'admin tutto.

## Strategia: RLS-First (sicurezza nativa)

Invece di costruire filtri custom per ruolo (fragile, duplicato), sfrutto le **policy RLS già esistenti** sul database. L'IA esegue query SQL **per conto dell'utente loggato** usando la sua sessione Supabase (anon key + JWT) → il DB applica automaticamente le restrizioni di visibilità che già governano tutta l'app.

L'IA NON ha mai accesso al `service_role_key`. Non può bypassare RLS. È sicura by design.

## Architettura

```text
Utente (chat sidebar/page)
   │  domanda in NL + JWT
   ▼
Edge Function "ai-assistant"
   │  1. Gemini 2.5 Flash con tool-calling
   │  2. Tool "query_database" → SQL whitelistato (SELECT only)
   │  3. Esegue SQL via supabase client con JWT utente (RLS attivo)
   │  4. Re-prompt Gemini con risultati → risposta NL
   ▼
Risposta in chat (markdown + dati citati)
```

### Componenti

**1. Edge Function `ai-assistant`** (nuova)
- Riceve: `{ messages: [...], conversation_id }` + Authorization header utente
- Crea client Supabase con il JWT dell'utente → tutte le query rispettano RLS
- Usa Lovable AI Gateway (Gemini 2.5 Flash, gratis fino a ott 2025) con system prompt che:
  - Descrive lo schema sintetico (tabelle/viste utili: `clienti`, `titoli`/`v_portafoglio_titoli`, `sinistri`, `compagnie`, `rami`, `uffici`, `trattative`, `provvigioni_generate`, `movimenti_contabili`)
  - Spiega le convenzioni (Sede=ufficio, stati polizza, ecc.)
  - Dichiara il tool `query_database(sql, description)`
- Esegue il tool: valida SQL (solo `SELECT`, no DDL/DML, limite righe 100), esegue, restituisce JSON al modello
- Loop max 5 tool calls per evitare runaway
- Salva la conversazione in nuova tabella `ai_chat_messaggi`

**2. Tabelle DB (nuova migration)**
- `ai_chat_conversazioni` — id, user_id, titolo, created_at
- `ai_chat_messaggi` — id, conversazione_id, role (user/assistant), content, tool_calls jsonb, created_at
- RLS: ogni utente vede solo le sue conversazioni

**3. UI Chat IA**
- Nuova pagina `/ai-assistant` (o sidebar drawer globale)
- Layout: lista conversazioni a sinistra + area chat a destra
- Render markdown per le risposte (`react-markdown` già pattern noto)
- Input con suggerimenti rapidi: "Quando scade la polizza di X?", "Sinistri aperti", "Provvigioni di aprile"
- Streaming opzionale (v2); v1 blocking
- Accessibile da topbar con icona ✨ (visibile a tutti i ruoli interni; per ruolo `cliente` mostra versione filtrata o nasconde — decido in implementazione)

**4. Sicurezza/Limiti**
- Whitelist SQL: solo `SELECT`, regex blocca `INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|GRANT|TRUNCATE`
- `LIMIT 100` forzato se assente
- Timeout query 10s
- Rate limit 30 msg/ora per utente (controllo lato function)
- Log attività (`logAttivita`) per ogni domanda critica

## Esempio flusso

> Utente Napoli: *"Quando scade la polizza del Comune di Santa Marina?"*

1. Gemini → tool `query_database`:  
   `SELECT numero_titolo, data_scadenza, c.ragione_sociale FROM titoli t JOIN clienti c ON c.id=t.cliente_anagrafica_id WHERE c.ragione_sociale ILIKE '%santa marina%' LIMIT 10`
2. RLS filtra: utente Napoli vede solo titoli del suo ufficio → 1 riga (332437571, 04/04/2026)
3. Gemini risponde: *"La polizza 332437571 del Comune di Santa Marina Salina scade il 04/04/2026 (ramo Infortuni Cumulativa, compagnia Assisud)."*

Stesso utente di Catania → RLS filtra → 0 righe → Gemini: *"Non risulta alcuna polizza visibile per questo cliente."*

## File toccati

**Nuovi:**
- `supabase/functions/ai-assistant/index.ts` — edge function principale
- `supabase/functions/ai-assistant/schema-context.ts` — descrizione schema per il prompt
- `supabase/migrations/<timestamp>_ai_chat.sql` — tabelle conversazioni/messaggi + RLS
- `src/pages/AiAssistantPage.tsx` — UI chat
- `src/components/ai/AiChatMessage.tsx` — bubble messaggio con markdown
- `src/components/ai/AiChatInput.tsx` — input + suggerimenti

**Modificati:**
- `src/App.tsx` — route `/ai-assistant`
- `src/components/AppSidebar.tsx` — voce "Assistente IA" con icona Sparkles
- `src/components/Topbar.tsx` (opzionale) — pulsante quick access

## Cosa NON cambia

- Schema dati esistente (lettura sola)
- Policy RLS esistenti (le sfruttiamo, non le modifichiamo)
- Edge function/AI già presenti

## Note implementazione

- Uso `LOVABLE_API_KEY` (già configurato) → endpoint `https://ai.gateway.lovable.dev/v1/chat/completions` con `google/gemini-2.5-flash`
- Schema context: lo costruisco a mano (~2KB) elencando solo tabelle/colonne realmente utili — non passo lo schema completo (troppi token)
- In v1 niente streaming: risposta blocking; aggiungo loader animato
