## Revisione completa modulo Provvigioni

Obiettivo: rendere coerenti, filtrabili e visualmente uniformi le tre pagine del modulo (`Provvigioni Consul`, `Provvigioni Maturate`, `Pagamenti Provvigioni`) introducendo filtri multidimensionali, grafici e una formattazione numerica/KPI condivisa.

---

### 1. Componenti condivisi (nuovi)

- `src/components/provvigioni/ProvvigioniKpiCard.tsx` — card KPI uniforme (icona, label, valore mono, delta opzionale, accent). Sostituisce le tre varianti attualmente diverse fra le pagine.
- `src/components/provvigioni/ProvvigioniFiltersBar.tsx` — barra filtri condivisa con: periodo (range mese/anno), `Ramo` (multi), `Compagnia` (multi), `Produttore/Commerciale` (multi via `SearchableSelect`), `Cliente` (search asincrono), `Tipo destinatario` (Consul/Commerciale/Sede). Stato gestito tramite URL search params.
- `src/components/provvigioni/ProvvigioniCharts.tsx` — set Recharts riutilizzabile:
  - Bar per Ramo
  - Bar per Produttore (top 10)
  - Line per mese (trend ultimi 12 mesi)
  - Pie split Consul vs Commerciali
- `src/lib/formatCurrency.ts` — `fmtEuro(v)` con `Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })`. Sostituisce le 3 implementazioni locali (`€ 0.00` → `€ 1.234,56`).

---

### 2. Provvigioni Consul (`ProvvigioniSedePage.tsx`)

Quota di Consulbrokers SPA su titoli incassati.

- KPI uniformi (`ProvvigioniKpiCard`): Tot. Consul, Tot. Commerciali, Tot. Agenzia, N° polizze, Premio totale.
- Sezione **Distribuzione**, 4 tab:
  - **Per Ramo**: aggregazione `ramo` → tabella + bar chart, percentuale sul totale.
  - **Per Produttore/Commerciale**: aggregazione `commerciale_id` (incluso "no commerciale = 100% Consul") → tabella + bar.
  - **Per Cliente**: top clienti + search; click → detail cliente.
  - **Per Periodo**: trend mensile ultimi 12 mesi (line).
- Tabella dettaglio sotto i tab, filtrata dai `ProvvigioniFiltersBar`. Colonne attuali + `Cliente`.
- Selettore mese sostituito da range completo nella filters bar.
- Export CSV del dato filtrato.

---

### 3. Provvigioni Maturate (`ProvvigioniMaturatePage.tsx`)

Vista del produttore/commerciale.

- Header con `ProvvigioniFiltersBar` (default = mese corrente).
- KPI uniformi: Totale Maturato, N° provvigioni, Destinatari unici, Premio incassato, Importo medio.
- **Grafici**: bar per produttore, bar per ramo, pie tipo destinatario, line trend 12 mesi.
- Tabella esistente (zebra preservata) con ordinamento colonne, paginazione 25, search testuale.
- Stato vuoto chiaro con istruzioni filtri (oggi mostra "Nessuna" anche quando ci sono dati fuori filtro).
- Bug fix: query attuale filtra `pagata=false` AND `solo_statistico=false` ma il join `titoli!inner` con `gte/lte` su `data_messa_cassa` può restituire 0 quando i titoli non hanno `data_messa_cassa` valorizzato — verificare e usare in alternativa `calcolata_il` come fallback.

---

### 4. Pagamenti Provvigioni (`PagamentiProvvigioniList.tsx`)

- KPI riallineati con `ProvvigioniKpiCard` e `fmtEuro` (oggi usa `€{x.toFixed(2)}` → grafica diversa).
- Filtri: beneficiario, periodo, metodo, stato (pagata/da pagare).
- Grafico: bar mensile pagamenti, pie per metodo.
- Tabella zebra, importi formattati `it-IT`.
- Dialog "Nuova Distinta": numeri formattati con `fmtEuro`, totale selezionato evidenziato.

---

### 5. Tecnico

- Nessuna modifica schema. Tutti gli aggregati lato client su query già esistenti, con `limit(1000)` e where indicizzati (`data_messa_cassa`, `stato='incassato'`).
- Per il trend 12 mesi su Consul: nuova query separata che raggruppa client-side (range 12 mesi).
- React Query keys che includono tutti i filtri per cache corretta.
- Tutti i colori dai token semantici (`--primary` teal, `--muted`, `--destructive`); nessun colore hex hardcoded nei chart (palette derivata da CSS vars).

---

### File toccati

**Nuovi**
- `src/components/provvigioni/ProvvigioniKpiCard.tsx`
- `src/components/provvigioni/ProvvigioniFiltersBar.tsx`
- `src/components/provvigioni/ProvvigioniCharts.tsx`
- `src/lib/formatCurrency.ts`

**Modificati**
- `src/pages/ProvvigioniSedePage.tsx` (riscrittura layout, mantenuta logica calcolo)
- `src/pages/ProvvigioniMaturatePage.tsx` (filtri + grafici + fix query)
- `src/pages/PagamentiProvvigioniList.tsx` (uniformazione KPI + filtri + grafico)
