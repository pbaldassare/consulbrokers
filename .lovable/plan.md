

## Piano: Pagina Storico Trattative con archiviazione aggregata

### Cosa viene creato

Una nuova pagina **Storico Trattative** accessibile dal menu, che mostra tutte le trattative chiuse (vinte/perse) o archiviate, con possibilita di archiviare in blocco dalla lista principale.

### Modifiche

#### 1. Migrazione DB: aggiungere campo `archiviata`
- Aggiungere `archiviata BOOLEAN DEFAULT false` alla tabella `trattative`
- Indice su `archiviata` per query performanti

#### 2. Nuova pagina `src/pages/StoricoTrattativePage.tsx`
- Query tutte le trattative con `archiviata = true` OR `stato IN ('chiusa_vinta', 'chiusa_persa')`
- Filtri: stato (vinta/persa/tutte), periodo (date range), ufficio, compagnia, ramo, fonte
- KPI in alto: totale archiviate, vinte vs perse (conteggio e %), premio totale vinto, premio totale perso
- Tabella con colonne: Tipo, Soggetto, Ramo, Compagnia, Premio, Stato, Motivo chiusura, Data chiusura, Fonte
- Possibilita di riaprire una trattativa (rimettere `archiviata = false`, stato a "aperta")
- Export CSV dei risultati filtrati

#### 3. Azione aggregata in `TrattativeList.tsx`
- Aggiungere checkbox su ogni riga + checkbox "seleziona tutto"
- Pulsante "Archivia selezionate" (visibile solo admin): conferma con AlertDialog, poi update massivo `archiviata = true` sulle trattative selezionate
- Pulsante rapido "Archivia tutte le chiuse": archivia in blocco tutte le `chiusa_vinta` e `chiusa_persa`
- Le trattative archiviate spariscono dalla lista principale (filtro `archiviata = false` o `archiviata IS NULL`)

#### 4. Routing e sidebar
- Rotta `/trattative/storico` in `src/routes/archivi.tsx`
- Voce nel sidebar sotto "Trattative" con icona Archive

### File coinvolti

| File | Azione |
|------|--------|
| Migrazione SQL | `ALTER TABLE trattative ADD COLUMN archiviata BOOLEAN DEFAULT false` |
| `src/pages/StoricoTrattativePage.tsx` | Nuova pagina con filtri, KPI, tabella, riapertura, export |
| `src/pages/TrattativeList.tsx` | Checkbox selezione, pulsanti archiviazione aggregata, filtro `archiviata = false` |
| `src/routes/archivi.tsx` | Aggiungere rotta `/trattative/storico` |
| `src/components/AppSidebar.tsx` | Voce "Storico Trattative" sotto Trattative |

