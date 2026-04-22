

## Storico Gare — refinements UI

### Cambiamenti richiesti

1. **Toggle "Solo nostri clienti" → "Solo Intermedia"**
   - In `StoricoGarePage.tsx` rinomino il filtro toggle.
   - Il filtro applica `WHERE broker_incumbent = 'INTERMEDIA'` (al posto del filtro su `cliente_id IS NOT NULL`).
   - Etichetta UI: "Solo Intermedia" (mostra solo le gare dove eravamo noi il broker incumbent).

2. **Rimozione KPI "Gare vinte"**
   - Tolgo la card centrale "2 — Gare vinte" (poco significativa: l'esito reale richiede arricchimento manuale dei dati).
   - Ridistribuisco le altre 2 card (Gare totali, Mandati in scadenza 12m) su layout `grid-cols-2`.

3. **Aggiunta grafici in alto** (sopra la barra filtri, sotto le KPI)
   - **Grafico A — Trend per anno** (barre verticali): conteggio gare per `anno_riferimento` (ultimi 13 anni). Mostra il volume di mercato annuo.
   - **Grafico B — Top 8 broker incumbent** (barre orizzontali): conteggio gare per `broker_incumbent`, ordinato desc. Evidenzia i competitor dominanti.
   - **Grafico C — Distribuzione per categoria ente** (donut/pie): % di gare per `categoria_ente` (comune, asl, regione, provincia, università, consorzio, società partecipata, altro).
   - I grafici **rispettano i filtri applicati** (anno, provincia, esito, broker, categoria, stato mandato, flag): se filtri "provincia=TV", anche i grafici si aggiornano a soli dati TV.
   - Layout: `grid-cols-1 lg:grid-cols-3` per affiancarli su desktop, stack su mobile.
   - Libreria: `recharts` (già nel progetto, usata in altre dashboard come ClienteDashboard).

### File da modificare

- `src/pages/StoricoGarePage.tsx`:
  - Rinomino state `soloNostriClienti` → `soloIntermedia` e cambio query da `.not('cliente_id', 'is', null)` a `.eq('broker_incumbent', 'INTERMEDIA')`.
  - Rimuovo il blocco JSX della card "Gare vinte" e la relativa query/conteggio.
  - Aggiungo 3 nuove query aggregate (con gli stessi filtri della tabella) per popolare i 3 grafici, gestite via `useEffect` parallelo a quello principale.
  - Aggiungo blocco `<Card>` con tre `<ResponsiveContainer>` recharts (`BarChart` verticale, `BarChart` orizzontale, `PieChart`).

### Cosa NON tocco

- Schema DB, vista `v_storico_gare`, trigger, edge function — già a posto.
- Filtri esistenti (anno, provincia, tipologia, esito, broker, categoria, stato), pagination, ricerca testuale.

### Verifica

1. La card "Gare vinte" sparisce; restano 2 KPI in alto (1693 totali + 138 in scadenza).
2. Il toggle in basso si chiama ora "Solo Intermedia"; attivandolo la lista scende a ~N record (quelli con `broker_incumbent='INTERMEDIA'`).
3. Sopra i filtri appaiono 3 grafici affiancati: barre per anno, top broker, donut per categoria ente.
4. Filtrando per "anno=2024" o "provincia=MI" i grafici si aggiornano coerentemente.

