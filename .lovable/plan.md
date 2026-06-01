## Problemi

1. **Polizze da Mettere a Cassa**: la query KPI include tutto lo scaduto, non solo il mese; il link punta a `/portafoglio/attive` (pagina sbagliata) con un query string che la pagina non legge.
2. **Incassi del Mese / Incassi Ieri**: linkano a `/contabilita/storico-rimesse` che mostra le *rimesse* (non i titoli incassati) e ignora il query string `?periodo=...`.

Le pagine `PortafoglioCaricoPage` e `StoricoRimessePage` non leggono affatto `useSearchParams`, quindi i query string attuali sono inerti.

## Soluzione

Allineare i KPI al concetto di **Carico del Mese** (titoli con `data_scadenza` nel mese corrente) e linkare tutti alla stessa pagina con il filtro corretto pre-applicato via URL.

### 1. `src/hooks/useDashboardData.ts` — query `polizzeDaCassa`

Restringere ai titoli del mese:
- `stato = 'attivo'`
- `data_messa_cassa IS NULL`
- `data_scadenza` tra `startOfMonth` e `endOfMonth` (sostituire l'attuale `lte(endOfMonth)` con range completo).

### 2. `src/pages/PortafoglioCaricoPage.tsx` — supporto query string

- Aggiungere `import { useSearchParams } from "react-router-dom"`.
- All'avvio, leggere `?stato=attivo|incassato|tutti` e inizializzare `filtroStato` di conseguenza (default `tutti`, come ora).
- Quando l'utente cambia il filtro tramite UI, aggiornare anche il query string (`setSearchParams`).

### 3. `src/pages/Dashboard.tsx` — link delle 4 card Admin

| Card | Nuovo link |
|------|------------|
| Rinnovi del Mese | `/portafoglio/carico` (tutti) |
| Polizze da Mettere a Cassa | `/portafoglio/carico?stato=attivo` |
| Incassi Ieri | `/portafoglio/carico?stato=incassato` |
| Incassi del Mese | `/portafoglio/carico?stato=incassato` |

Tutti puntano alla stessa pagina "Carico del Mese" con il filtro pre-applicato, coerente con il conteggio mostrato in dashboard.

## File toccati

- `src/hooks/useDashboardData.ts`
- `src/pages/PortafoglioCaricoPage.tsx`
- `src/pages/Dashboard.tsx`

## Note

- "Incassi Ieri" mostrerà tutte le polizze incassate del mese (non solo ieri) perché la pagina Carico filtra per mese; il numero della KPI resta accurato sul giorno di ieri. Se vuoi un filtro "solo ieri" separato lo aggiungiamo in un secondo step (richiederebbe un nuovo controllo data nella pagina Carico).
