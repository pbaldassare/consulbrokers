

## Piano: Cancellazione portafoglio_incassi

Eliminare tutti i 160 record residui dalla tabella `portafoglio_incassi` tramite il tool di insert/data operations.

### Operazione

```sql
DELETE FROM portafoglio_incassi;
```

Una singola query. Dopo l'esecuzione, il database sarà completamente pulito: zero polizze, zero titoli, zero incassi.

### File coinvolti

Nessuna modifica al codice. Solo operazione dati sul DB.

