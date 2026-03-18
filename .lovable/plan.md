

## Piano: Collegare Dashboard a dati reali dal database

### Situazione attuale
La Dashboard mostra tutti valori statici "0" senza alcuna query al database. Tutti i dati demo sono già presenti nelle tabelle Supabase (clienti, titoli, sinistri, movimenti_contabili, provvigioni, ecc.).

### Modifiche previste

**File: `src/pages/Dashboard.tsx`**

Aggiungere `useEffect` + `useState` per caricare i KPI reali da Supabase per ogni dashboard role-based.

#### AdminDashboard - Query e KPI:
1. **Utenti Attivi**: `profiles` → count where `attivo = true`
2. **Polizze Attive**: `titoli` → count where `stato = 'attivo'`
3. **Sinistri Aperti**: `sinistri` → count where `stato in ('aperto','in_gestione')`
4. **Anomalie Critiche**: `anomalie_sistema` → count where `stato != 'risolta'`
5. **Raccolta Premi**: `titoli` → sum `importo_incassato` where anno corrente
6. **Nuovi Clienti**: `clienti` → count where `created_at` nel mese corrente
7. **Tasso Rinnovo**: calcolato da titoli rinnovati/scaduti
8. **Uffici Attivi**: `uffici` → count where `attivo = true`
9. **Distribuzione Polizze per Ramo**: join `titoli → prodotti → categorie_prodotto`, group by categoria (grafico a torta con Recharts)
10. **Andamento Raccolta Premi**: `titoli` raggruppati per mese, sum `importo_incassato` (grafico a barre con Recharts)
11. **Attività Recenti**: `log_attivita` → ultime 10, join con profiles per mostrare utente e azione

#### UfficioDashboard - filtrato per `ufficio_id` dell'utente:
- Clienti ufficio, incassi recenti, sinistri aperti, scadenze prossime 30gg
- Grafici incassi mensili e sinistri per stato

#### ProduttoreDashboard - filtrato per `produttore_id = auth.uid()`:
- Trattative aperte, titoli creati anno corrente, provvigioni maturate non pagate

#### CfoDashboard - usa le funzioni SQL già esistenti (`cfo_kpi`, `cfo_entrate_uscite_mensili`):
- Entrate/uscite totali, redditività, provvigioni da pagare

#### ContabilitaDashboard:
- Anomalie incroci KO, incassi KO da `incroci_bancari`

### Approccio tecnico
- Creare un custom hook `useDashboardData(ruolo)` che centralizza tutte le query
- Usare `supabase.from().select()` per count/sum con `.count('exact')` e aggregazioni
- Per i grafici: aggiungere **Recharts** (già disponibile nel progetto) ai `PlaceholderChart` rendendoli componenti dinamici
- Loading skeleton durante il fetch
- I dati CFO useranno `supabase.rpc('cfo_kpi')` e le altre funzioni SQL già definite

### Grafici
- **Distribuzione Polizze per Ramo**: `PieChart` Recharts
- **Andamento Raccolta Premi**: `BarChart` Recharts, dati mensili ultimi 12 mesi
- **Attività Recenti**: lista reale con icone e timestamp

