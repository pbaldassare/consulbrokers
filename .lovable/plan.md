## Problema confermato

L'Excel caricato contiene **107 righe distinte**, ma in `movimenti_bancari` ci sono **428 record = 107 × 4**: l'import è stato eseguito 4 volte (timestamp 13:09, 13:09, 13:18, 13:18) e ogni esecuzione ha re-inserito tutte le righe perché non esiste alcun controllo di deduplica.

## Piano di intervento

### 1. Cleanup dei duplicati già presenti (migrazione SQL una tantum)
- Per ogni gruppo `(data_movimento, importo, ordinante, descrizione)` mantenere **solo la riga più vecchia** (`MIN(created_at)`).
- Cancellare le altre 3 copie (321 record).
- Sicuro: tutti i duplicati hanno stesso `cliente_id`/`ufficio_id`/`stato='matchato'`, nessuna distinzione informativa.

```sql
DELETE FROM movimenti_bancari m
USING (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY data_movimento, importo, ordinante, descrizione
    ORDER BY created_at ASC
  ) AS rn
  FROM movimenti_bancari
) d
WHERE m.id = d.id AND d.rn > 1;
```

### 2. Indice unico per prevenire nuovi duplicati
Aggiungere un indice unico parziale (o constraint) per bloccare a livello DB futuri re-import:

```sql
CREATE UNIQUE INDEX uq_movimenti_bancari_dedup
  ON movimenti_bancari (data_movimento, importo, ordinante, md5(descrizione));
```

### 3. Gestione lato edge function / UI di import
Nell'edge function che importa l'Excel (o nella query di insert), usare `ON CONFLICT DO NOTHING` sull'indice sopra, così re-import dello stesso file diventa idempotente. Tornare un riepilogo "X righe nuove, Y già presenti".

### 4. Verifica post-cleanup
- `SELECT COUNT(*)` su `movimenti_bancari` deve tornare 107.
- Riaprire la pagina Monitor real-time e Caricamento Mov. Bancari per controllare che il conteggio sia corretto.

## Domanda per te
- Confermi che posso **cancellare i 321 duplicati** mantenendo solo la prima occorrenza?
- Vuoi che aggiunga anche il vincolo unico + `ON CONFLICT DO NOTHING` nell'import (consigliato), oppure solo il cleanup per ora?
