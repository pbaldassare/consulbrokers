

## Piano: Fix visualizzazione trattative - soggetto ente, bando semplificato, scadenza

### Problemi identificati

1. **Soggetto**: per i prospect di tipo "ente", il nome viene da `ragione_sociale` ma la query seleziona solo `nome, cognome`. L'ente risulta vuoto.
2. **Colonna Ramo**: mostra il campo `prodotto` ("affidamento") che non e' utile. L'utente dice che il ramo non serve nella tabella.
3. **Colonna Bando**: mostra il nome dell'ente, dovrebbe mostrare il titolo del bando in modo semplificato.
4. **Colonna Data**: mostra `created_at`, dovrebbe mostrare `data_scadenza` (la scadenza del bando/trattativa).

### Modifiche in `src/pages/TrattativeList.tsx`

1. **Query prospect**: aggiungere `ragione_sociale, tipo_cliente` alla select del prospect join
2. **`getSoggettoName`**: per prospect con `tipo_cliente === 'ente'`, usare `ragione_sociale`
3. **Rimuovere colonna Ramo**: togliere header e cella "Ramo" dalla tabella
4. **Colonna Bando**: mostrare titolo del bando abbreviato (primi ~60 caratteri) invece dell'ente
5. **Colonna Data**: rinominare in "Scadenza" e mostrare `data_scadenza` invece di `created_at`
6. **Filtro ricerca**: aggiornare per cercare anche su `ragione_sociale` e bando titolo

### File coinvolti

| File | Azione |
|------|--------|
| `src/pages/TrattativeList.tsx` | Fix query prospect, getSoggettoName per enti, rimuovere Ramo, fix Bando e Data |

