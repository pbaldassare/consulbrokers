## Obiettivo

Dashboard Admin: tenere solo **4 card cliccabili** che linkano alle pagine corrispondenti. Rimuovere il blocco "Raccolta Premi Anno" + "Nuovi Clienti Mese".

## Card finali (in ordine)

| Card | Valore / Sotto | Link |
|------|----------------|------|
| Rinnovi del Mese | count + €  premio | `/portafoglio/carico` |
| Polizze da Mettere a Cassa | count + € premio | `/portafoglio/attive?stato=non_incassate` |
| Incassi di Ieri | count + € | `/contabilita/storico-rimesse?periodo=ieri` |
| Incassi del Mese | count + € | `/contabilita/storico-rimesse?periodo=mese` |

Tutte e quattro restano `SummaryCard` (variante visuale già esistente), griglia `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.

## Modifiche a `src/hooks/useDashboardData.ts`

1. **`AdminData`**: rimuovere `raccoltaPremiAnno` e `nuoviClientiMese`; aggiungere:
   - `polizzeDaCassaCount: number`
   - `polizzeDaCassaImporto: number`
2. **`loadAdmin`**:
   - Rimuovere le query `raccoltaAnno` e `nuoviClientiMese`.
   - Aggiungere query "polizze da mettere a cassa": `v_portafoglio_titoli` con `stato = 'attivo'`, `data_messa_cassa IS NULL`, `data_scadenza <= endOfMonth` (include scadute e in scadenza nel mese corrente). `select premio_lordo, { count: 'exact' }`, `limit(10000)`.
   - Aggiornare `setAdmin({...})` di conseguenza.

## Modifiche a `src/pages/Dashboard.tsx`

1. `AdminDashboard`: sostituire la 3ª e 4ª `SummaryCard` se serve riordinare, mantenere 4 totali:
   - Rinnovi Mese → `/portafoglio/carico`
   - Polizze da Mettere a Cassa → `/portafoglio/attive` (passare query string `?stato=non_incassate` se la pagina la supporta; altrimenti solo `/portafoglio/attive`)
   - Incassi Ieri → `/contabilita/storico-rimesse`
   - Incassi Mese → `/contabilita/storico-rimesse`
2. **Eliminare** il blocco `<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">` con i due `KpiCard` (Raccolta Premi Anno + Nuovi Clienti Mese).
3. Lasciare invariato il pannello "Chat Non Risposte".

## File toccati

- `src/hooks/useDashboardData.ts`
- `src/pages/Dashboard.tsx`

## Note

- Le altre dashboard (ufficio, produttore, contabilità, cfo, cliente) restano invariate — saranno configurate dopo come richiesto.
- Se la pagina `/portafoglio/attive` non supporta il filtro `?stato=non_incassate`, il link punterà alla pagina senza query string e potremo aggiungere il filtro come step successivo.
