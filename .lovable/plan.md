

## Piano: Collegare filtri a ogni colonna della tabella Trattative

### Stato attuale
I filtri esistenti sono: ricerca testuale, stato, ufficio. Mancano filtri per: tipo (prospect/cliente), compagnia, scadenza (range date).

### Modifiche in `src/pages/TrattativeList.tsx`

1. **Nuovo filtro Tipo soggetto**: Select con opzioni "Tutti", "Prospect", "Cliente" — filtra su `cliente_id` presente o meno
2. **Nuovo filtro Compagnia**: Select con le compagnie gia caricate da `compagnie` lookup — filtra su `compagnia_id`
3. **Nuovo filtro Scadenza (range date)**: Due input date (Da / A) per filtrare `data_scadenza` nel range selezionato
4. **Aggiornare logica `filtered`**: Aggiungere i nuovi filtri alla catena di condizioni

### Layout filtri
Tutti i filtri sulla stessa riga flex-wrap: Ricerca | Tipo | Stato | Compagnia | Ufficio | Scadenza Da | Scadenza A

### File coinvolti

| File | Azione |
|------|--------|
| `src/pages/TrattativeList.tsx` | Aggiungere stati filtro (`filtroTipo`, `filtroCompagnia`, `filtroScadenzaDa`, `filtroScadenzaA`), Select per tipo e compagnia, input date per range scadenza, logica filtering |

