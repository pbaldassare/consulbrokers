

## Piano: Potenziamento Contabilita e Contabilita Generale

### Stato implementazione

| # | Feature | Stato |
|---|---------|-------|
| 1 | Dashboard Contabile Giornaliera (Cruscotto del Giorno) | ✅ Completato |
| 2 | Distinta Giornaliera Automatica | ✅ Completato |
| 3 | Verifica Arrivo Premi (Quadratura Premi) | ✅ Completato |
| 4 | Chiusura Contabile Guidata | ✅ Completato |
| 5 | Alert Intelligenti Contabili | 🔲 Da fare |
| 6 | Report Comparativo Uffici | 🔲 Da fare |

### Tabelle DB create
- `distinte_giornaliere` — storico distinte con stato aperta/chiusa/riaperta
- `distinte_giornaliere_righe` — singoli movimenti nella distinta
- `chiusure_contabili` — tracking workflow di chiusura con 5 step booleani

### Pagine create
- `src/pages/contabilita/CruscottoGiornaliero.tsx` — KPI giornalieri, anomalie, scadenze, movimenti non riconciliati
- `src/pages/contabilita/DistintaGiornaliera.tsx` — generazione/chiusura/export CSV distinta
- `src/pages/contabilita/QuadraturePremi.tsx` — incrocio titoli attesa vs estratti conto
- `src/pages/contabilita/ChiusuraContabile.tsx` — workflow step-by-step per chiusura periodo

### Routing aggiunto
- `/contabilita/cruscotto` → Cruscotto del Giorno
- `/contabilita/distinta-giornaliera` → Distinta Giornaliera
- `/contabilita/quadratura-premi` → Quadratura Premi
- `/contabilita/chiusura-contabile` → Chiusura Contabile

### Sidebar aggiornata
Gruppo "Contabilità" ora include: Cruscotto del Giorno, Incassi e Coperture, Distinta Giornaliera, Quadratura Premi, Chiusura Contabile, Avvisi Incasso, E/C Clienti, E/C Compagnia, E/C Produttori, Stampa Primanota, Check Primanota, Stampa Sospesi
