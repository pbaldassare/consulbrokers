## Espansione Area CFO: Grafici Avanzati + AI Analista

L'Area CFO esistente ha già 6 grafici base (Entrate/Uscite, Premi per Compagnia/Ramo/Produttore, Redditività Sede, Provvigioni mensili) + Report Titoli + Pagamenti. Estendiamo con **nuove intersezioni** richieste (per periodo / cliente / polizza / ramo / media) e una **tab "AI Analista CFO"** per chat in linguaggio naturale.

### 1. Nuovi grafici / KPI (tab "Grafici" estesa con sotto-sezioni)

Sotto-tab dentro "Grafici":

**a) Periodo & Trend**
- Trend annuale Premi vs Provvigioni vs Margine (LineChart 36 mesi mobili)
- YoY: confronto anno corrente vs precedente per mese (BarChart raggruppato)
- Heatmap mese × ramo (premi incassati) — ScatterChart con cella colorata
- Premio medio mensile (LineChart)

**b) Clienti**
- Top 20 clienti per premi incassati (BarChart orizzontale)
- Top 20 clienti per margine (premi − provvigioni) 
- Distribuzione clienti per fascia premio (PieChart: <500€, 500-2k, 2k-10k, >10k)
- Numero polizze per cliente (istogramma)
- Clienti nuovi vs ricorrenti per mese (StackedBar)

**c) Polizza / Ramo**
- Premio medio per ramo (BarChart)
- Premio medio per compagnia (BarChart)
- Mix prodotti: Treemap ramo → compagnia
- Tasso di rinnovo per ramo (% rinnovate / scadute) — BarChart
- Durata media polizze per ramo
- Distribuzione stato polizze (attivo/sospeso/scaduto/incassato) — PieChart

**d) Produttori / Sedi (intersezioni)**
- Matrice Sede × Compagnia (heatmap premi)
- Matrice Produttore × Ramo (heatmap premi)
- Provvigione % media per produttore (BarChart)
- Conversion rate trattative → polizze per produttore

**e) Sinistri & Rischio**
- Loss ratio per ramo (sinistri pagati / premi)
- Sinistri aperti per età (0-30, 30-90, 90+ giorni)
- Sinistri per compagnia (BarChart)

Tutti i grafici rispettano i **filtri globali esistenti** (data, sede, compagnia, produttore) e hanno tooltip con valuta formattata.

### 2. Tab "AI Analista" (nuova)

Nuova tab dentro `AreaCFO.tsx` con chat conversazionale:
- Input testuale + storico messaggi (markdown rendering con `react-markdown`)
- L'utente fa domande tipo:
  - "Qual è stato il margine sul ramo RC Auto a marzo 2026?"
  - "Mostrami i 10 clienti che hanno reso di più nell'ultimo trimestre"
  - "Quale produttore ha la migliore redditività sul ramo Vita?"
  - "Confronta premi 2026 vs 2025 per compagnia X"
- Risposte dell'AI: testo + tabella + (opzionale) grafico generato dinamicamente dai dati restituiti
- Suggerimenti rapidi (chips) con domande predefinite

### 3. Implementazione tecnica

**Frontend**
- Estendere `src/pages/AreaCFO.tsx`: aggiungere sotto-tabs in "Grafici" + nuova tab "AI Analista"
- Nuovo componente `src/components/cfo/CfoAiChat.tsx` (chat UI riutilizzabile)
- Nuovo componente `src/components/cfo/CfoChartCard.tsx` per uniformare card grafico

**Backend (Supabase)**
- **Migrazione SQL**: nuove RPC (SECURITY DEFINER, `SET search_path=public`) — tutte filtrabili per `_data_da/_data_a/_ufficio_id/_compagnia_id/_produttore_nome`:
  - `cfo_trend_yoy()` — premi/provv/margine per mese ultimi 24 mesi + flag anno
  - `cfo_heatmap_mese_ramo()` — totali premi pivot mese × ramo
  - `cfo_top_clienti(_metric, _limit)` — top N clienti per metrica (premi/margine/polizze)
  - `cfo_distribuzione_clienti_fascia()` — count clienti per fascia premio
  - `cfo_premio_medio_per_ramo()` / `cfo_premio_medio_per_compagnia()`
  - `cfo_mix_ramo_compagnia()` — per Treemap
  - `cfo_tasso_rinnovo_per_ramo()`
  - `cfo_durata_media_polizze_ramo()`
  - `cfo_distribuzione_stati_polizze()`
  - `cfo_matrice_sede_compagnia()` / `cfo_matrice_produttore_ramo()`
  - `cfo_provv_pct_media_produttore()`
  - `cfo_conversion_trattative_produttore()`
  - `cfo_loss_ratio_per_ramo()`
  - `cfo_eta_sinistri_aperti()`
  - `cfo_sinistri_per_compagnia()`
- Tutte rispettano la regola "NO dati simulati" (memory `real-data-preference`).

**Edge Function: `cfo-ai-analyst`**
- Nuova edge function che riceve `{ messages, filters }`
- Costruisce system prompt con: schema DB rilevante (tabelle `titoli`, `clienti`, `compagnie`, `sinistri`, `provvigioni_generate`, viste portafoglio) + lista RPC CFO disponibili + filtri attivi correnti
- Tool calling Lovable AI Gateway (`google/gemini-3-flash-preview`) con tool `query_cfo_data` che mappa a una RPC sicura whitelisted (mai SQL libero)
- Streaming SSE delle risposte
- L'AI può chiamare 1+ RPC, riceve i risultati e li sintetizza in risposta testuale + (opzionalmente) restituisce blocco JSON per renderizzare grafico inline
- Solo whitelisted RPC eseguibili — nessun SQL arbitrario (rispetta vincoli sicurezza)
- `verify_jwt = true` (richiede sessione admin/cfo)

**Sicurezza**
- Pagina già protetta da `RoleGuard allowedRoles={["admin", "cfo"]}`
- Tutte le RPC `SECURITY DEFINER` filtrano implicitamente solo dati del workspace
- Edge function valida JWT e ruolo (admin/cfo) prima di rispondere

### 4. UX

```text
Area CFO
├── Filtri globali (esistenti)
├── KPI cards (esistenti)
└── Tabs
    ├── Grafici  ← sotto-tabs: Periodo | Clienti | Polizze | Produttori | Sinistri
    ├── Report   (esistente)
    ├── Pagamenti Provvigioni (esistente)
    └── AI Analista ← NUOVO (chat + suggested prompts)
```

### 5. Out of scope (rinviabile)
- Generazione PDF dei report grafici
- Salvataggio storico conversazioni AI
- Export Excel multi-sheet (solo CSV come oggi)
