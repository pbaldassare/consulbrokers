## Obiettivo

Rendere l'Area CFO più robusta e interattiva:
1. **Stati visivi uniformi** (loading, empty, errore) per ogni grafico e per il chat AI Analista.
2. **Drill-down al click**: cliccando su una barra/fetta/cella di un grafico si apre un dialog con la tabella dei record dettagliati che compongono quel valore, rispettando i filtri applicati.

---

## 1. Componente wrapper unificato `CfoChartCard`

Nuovo file `src/components/cfo/CfoChartCard.tsx` che incapsula ogni grafico con la stessa UX:

- **Loading**: `Skeleton` a tutta altezza + spinner centrale (sostituisce gli attuali `Loader2` sparsi).
- **Empty**: icona + messaggio "Nessun dato per i filtri selezionati" + suggerimento a ridurre i filtri.
- **Errore**: card rossa con messaggio dell'errore + bottone "Riprova" che invalida la query.
- **Header standard**: titolo, sottotitolo opzionale, badge conteggio righe, bottone "Espandi" (apre drill-down completo) e "Esporta CSV".
- Props: `title`, `query` (oggetto `useQuery` già istanziato), `isEmpty`, children grafico, `onDrillDown(payload)` opzionale.

Tutti i grafici esistenti in `AreaCFO.tsx` (Trend mensile, YoY, Top clienti, Loss ratio, Distribuzione stati, Premio medio ramo, Treemap, Età sinistri, Matrice Sede×Compagnia, Matrice Produttore×Ramo) vengono avvolti in questo wrapper.

---

## 2. Drill-down: dialog + RPC dedicate

### Componente `CfoDrillDownDialog`
Nuovo file `src/components/cfo/CfoDrillDownDialog.tsx`:
- `Dialog` largo (`max-w-6xl`) con titolo dinamico ("Dettaglio: Ramo RCA — Gennaio 2026").
- Mostra **chip dei filtri applicati** (periodo, sede, compagnia, produttore + chiave del drill).
- Tabella zebra paginata client-side (25 righe), colonne: data effetto, cliente, polizza, ramo, compagnia, sede, produttore, premio, provvigione, stato.
- Bottoni: "Esporta CSV", "Apri polizza" (link a `/titoli/:id`), "Chiudi".
- Skeleton durante il fetch, empty state se 0 risultati.

### Logica di click sui grafici
Ogni grafico riceve un handler `onClick` di recharts:
- BarChart trend mensile → drill su `mese` (es. `2026-03`).
- BarChart YoY → drill su `mese` + `anno`.
- BarChart top clienti → drill su `cliente_id`.
- PieChart distribuzione stati → drill su `stato`.
- BarChart loss ratio / premio medio ramo → drill su `ramo`.
- Treemap ramo → drill su `ramo`.
- Celle matrici (Sede×Compagnia, Produttore×Ramo) → drill su coppia chiavi.

Il payload del click viene tradotto in un set di filtri aggiuntivi e passato al dialog.

### Nuove RPC drill-down (una migration)
Tutte `SECURITY DEFINER`, ritornano max 500 righe, accettano i filtri globali + chiave drill:

- `cfo_drill_titoli(_data_da, _data_a, _ufficio_id, _compagnia_id, _produttore_nome, _mese text, _ramo text, _cliente_id uuid, _stato text, _sede_id uuid)` — RPC unica generica che applica i filtri non-null e ritorna le righe titoli con join cliente/compagnia/sede/ramo.
- `cfo_drill_sinistri(...)` — analoga per i grafici sinistri (loss ratio, età sinistri).

Una singola RPC generica per dominio mantiene il backend semplice e copre tutti i drill-down dei grafici esistenti.

---

## 3. AI Analista — robustezza

In `src/components/cfo/CfoAiChat.tsx`:
- **Loading**: già presente, ma aggiungiamo "ETA stimata" + possibilità di **annullare** la richiesta (AbortController).
- **Empty state**: già presente, lasciato com'è.
- **Errore**: messaggio inline rosso con bottone "Riprova ultima domanda" (riinvia l'ultimo messaggio user senza doverlo riscrivere).
- **Errori specifici** dall'edge function (rate limit 429, payment 402, schema sconosciuto) → toast con messaggio human-friendly invece di stringa raw.
- **Timeout client-side** a 60s con messaggio chiaro se la function non risponde.
- Aggiunto bottone "Cancella conversazione" in alto a destra del chat.

---

## 4. Dettagli tecnici

### File toccati
- **Nuovo**: `src/components/cfo/CfoChartCard.tsx`
- **Nuovo**: `src/components/cfo/CfoDrillDownDialog.tsx`
- **Modificato**: `src/pages/AreaCFO.tsx` — wrap di ogni grafico con `CfoChartCard`, aggiunta logica click + state per drill-down attivo.
- **Modificato**: `src/components/cfo/CfoAiChat.tsx` — abort, retry, toast errori, clear conversation.
- **Nuova migration**: `supabase/migrations/<ts>_cfo_drilldown_rpcs.sql` con `cfo_drill_titoli` e `cfo_drill_sinistri`.

### Pattern stati
```text
query.isLoading → <Skeleton />
query.isError    → <ErrorState onRetry={query.refetch} />
data.length===0  → <EmptyState />
default          → <Chart />
```

### Esportazione CSV
Riutilizzo del pattern già usato in `EstrazioniStampePage` (Blob + download anchor), nessuna libreria nuova.

---

## Fuori scope
- Salvataggio storico drill-down / preferiti.
- Drill-down ricorsivo (drill nel drill).
- Streaming SSE per AI chat (resta JSON one-shot).
- Persistenza conversazioni AI lato DB.
