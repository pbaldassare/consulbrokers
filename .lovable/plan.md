

## Estendere l'AI Assistant a Trattative e Prospect

L'Assistente IA (`/ai-assistant`) oggi può tecnicamente leggere `trattative` e `prospect` (sono già nello `schema-context.ts`), ma in pratica:

- I **suggerimenti** in homepage chat parlano solo di polizze/sinistri/provvigioni → l'utente non sa che può chiedere trattative/prospect.
- Lo **schema context** ha solo 2 esempi sintetici per trattative e ZERO per prospect → il modello sbaglia colonne (es. cerca `responsabile_id` invece di `assegnato_a`, `data_creazione` invece di `created_at`) e risponde "nessun dato".
- Mancano riferimenti utili: relazione `prospect.convertito_cliente_id → clienti`, JOIN trattative→prospect/clienti, conteggi pipeline per stato, conversion rate.

## Modifiche

### 1. `supabase/functions/ai-assistant/schema-context.ts`

**a) Sezione "trattative" più ricca**
- Documento i campi reali verificati a DB: `id, prospect_id, cliente_id, compagnia_id, ramo_id, ufficio_id, prodotto (text), sottoprodotto, compagnia (text legacy), fonte, premio_previsto, premio_effettivo, stato, priorita, data_apertura, data_scadenza, data_chiusura, motivo_chiusura, assegnato_a, created_by, archiviata, note, created_at, updated_at`.
- Chiarisco la convenzione: `compagnia` è testo legacy, usare `compagnia_id → compagnie.nome` quando possibile.
- Stati validi (già censiti): `aperta | contatto | preventivo | in_negoziazione | chiuso_vinto | chiuso_perso`.

**b) Sezione "prospect" completa**
- Aggiungo i campi presenti davvero (privato/azienda): `nome, cognome, ragione_sociale, codice_fiscale, partita_iva, tipo_cliente, email, pec, telefono, cellulare, citta_residenza/sede, provincia_residenza/sede, fonte, stato, assegnato_a, ufficio_id, convertito_cliente_id, created_at, settore, attivita, codice_ateco, fascia_fatturato, fascia_dipendenti`.
- Regola di nome visibile: `COALESCE(ragione_sociale, NULLIF(TRIM(cognome||' '||nome),''), email)`.
- Convenzione conversione: `convertito_cliente_id IS NOT NULL` → prospect convertito in cliente.

**c) Nuovi esempi di query** (aggiunti in fondo):

```sql
-- Pipeline trattative per stato (totali e premio):
SELECT stato, COUNT(*) AS num, SUM(premio_previsto) AS premio_previsto, SUM(premio_effettivo) AS premio_effettivo
FROM trattative WHERE COALESCE(archiviata,false)=false
GROUP BY stato ORDER BY num DESC;

-- Le mie trattative aperte ordinate per scadenza:
SELECT t.id, COALESCE(c.ragione_sociale, c.cognome||' '||c.nome, p.ragione_sociale, p.cognome||' '||p.nome) AS contatto,
       t.prodotto, t.stato, t.priorita, t.data_scadenza, t.premio_previsto
FROM trattative t
LEFT JOIN clienti c ON c.id = t.cliente_id
LEFT JOIN prospect p ON p.id = t.prospect_id
WHERE t.assegnato_a = auth.uid() AND t.stato NOT IN ('chiuso_vinto','chiuso_perso')
ORDER BY t.data_scadenza ASC NULLS LAST LIMIT 50;

-- Trattative chiuse vinte ultimo trimestre con premio:
SELECT date_trunc('month', data_chiusura) AS mese, COUNT(*) AS vinte, SUM(premio_effettivo) AS premio
FROM trattative
WHERE stato='chiuso_vinto' AND data_chiusura >= CURRENT_DATE - INTERVAL '3 months'
GROUP BY 1 ORDER BY 1;

-- Conversion rate trattative per ufficio (ultimo anno):
SELECT u.nome_ufficio,
  COUNT(*) FILTER (WHERE stato='chiuso_vinto') AS vinte,
  COUNT(*) FILTER (WHERE stato='chiuso_perso') AS perse,
  ROUND(100.0 * COUNT(*) FILTER (WHERE stato='chiuso_vinto')
       / NULLIF(COUNT(*) FILTER (WHERE stato IN ('chiuso_vinto','chiuso_perso')),0), 1) AS win_rate_pct
FROM trattative t LEFT JOIN uffici u ON u.id=t.ufficio_id
WHERE data_chiusura >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY u.nome_ufficio ORDER BY win_rate_pct DESC NULLS LAST;

-- Prospect aperti per fonte:
SELECT fonte, COUNT(*) AS num
FROM prospect WHERE convertito_cliente_id IS NULL
GROUP BY fonte ORDER BY num DESC;

-- Miei prospect non convertiti più vecchi di 30 giorni (da risollecitare):
SELECT id, COALESCE(ragione_sociale, cognome||' '||nome) AS nominativo, fonte, stato, created_at
FROM prospect
WHERE assegnato_a = auth.uid() AND convertito_cliente_id IS NULL
  AND created_at < NOW() - INTERVAL '30 days'
ORDER BY created_at ASC LIMIT 50;

-- Prospect convertiti in cliente quest'anno con prima polizza:
SELECT p.id AS prospect_id, COALESCE(p.ragione_sociale, p.cognome||' '||p.nome) AS contatto,
       p.convertito_cliente_id, MIN(v.data_decorrenza) AS prima_polizza, COUNT(v.id) AS num_polizze
FROM prospect p
LEFT JOIN v_portafoglio_titoli v ON v.cliente_anagrafica_id = p.convertito_cliente_id
WHERE p.convertito_cliente_id IS NOT NULL
  AND EXTRACT(YEAR FROM p.updated_at) = EXTRACT(YEAR FROM CURRENT_DATE)
GROUP BY p.id, p.ragione_sociale, p.cognome, p.nome, p.convertito_cliente_id
ORDER BY prima_polizza DESC NULLS LAST LIMIT 30;
```

### 2. `src/pages/AiAssistantPage.tsx` — chip suggerimenti

Sostituisco l'array `SUGGESTIONS` con 6 voci che coprono anche il commerciale:

```tsx
const SUGGESTIONS = [
  "Quante trattative aperte ho?",
  "Pipeline trattative per stato",
  "Polizze in scadenza nei prossimi 30 giorni",
  "Prospect non convertiti più vecchi di 30 giorni",
  "Conversion rate trattative ultimo anno",
  "Provvigioni totali di questo mese",
];
```

E aggiorno il sottotitolo placeholder: "Polizze, scadenze, sinistri, **trattative, prospect**, provvigioni, contabilità…".

### 3. Niente modifiche a DB

Non servono nuove tabelle/colonne/RLS: `trattative` e `prospect` hanno già le RLS attive e l'AI passa attraverso `ai_exec_select` (SELECT-only) con la sessione utente.

### 4. Memory

Nessuna nuova memoria da creare: questa è una rifinitura del contesto AI, non una regola di prodotto. Le memorie esistenti su trattative (`negotiation-trattative-management`) e prospect (`prospect-user-role-and-portal`, `prospect-to-client-conversion`) restano valide.

## Verifica

1. Su `/ai-assistant`, in nuova conversazione, vedo i nuovi chip incluso "Quante trattative aperte ho?".
2. Clicco "Pipeline trattative per stato" → l'AI esegue la query GROUP BY e risponde con tabella stati / numero / premio.
3. Chiedo "Quanti prospect non convertiti ha la sede di Milano?" → l'AI usa `prospect.convertito_cliente_id IS NULL` + JOIN su `uffici`.
4. Chiedo "Mostrami le mie trattative aperte" → usa `assegnato_a = auth.uid()` (non più `responsabile_id` come capitava prima).
5. Da utente non admin con RLS commerciale: vede solo le proprie trattative/prospect (comportamento RLS invariato).

