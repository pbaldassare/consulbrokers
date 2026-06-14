
## Obiettivo

Unificare il gruppo compagnia **GC052 – ELBA** dentro **GC104 – REVO**. L'agenzia/direzione "ELBA – REVO Insurance S.p.A. direzione" resta come unica direzione di REVO.

## Stato attuale

- `GC052 – ELBA` (`33866159-9c8a-451f-9756-e607f268dc93`): nessuna compagnia, nessun rapporto collegato (orfano).
- `GC104 – REVO` (`9dd883b6-348f-4a2c-9744-51c54a17863a`): collegata l'agenzia direzione ELBA.

Non risultano riferimenti residui a GC052 in `compagnie` né in `compagnia_rapporti`. Nessun altro oggetto (titoli, provvigioni, rapporti, rami) referenzia direttamente `gruppi_compagnia`.

## Azione

Una singola operazione dati:

```sql
DELETE FROM gruppi_compagnia
WHERE id = '33866159-9c8a-451f-9756-e607f268dc93'; -- GC052 ELBA
```

Nessuna modifica di schema, codice o RLS.

## Verifica

1. In `/portafoglio/immissione` la tendina **Compagnia Assicurativa** non mostra più "GC052 – ELBA".
2. Selezionando **GC104 – REVO** compare in **Agenzia di Riferimento** la voce "ELBA – REVO Insurance S.p.A. direzione".
3. La pagina `/compagnie` per la riga REVO mostra ancora la direzione ELBA collegata.

## Note

- Pattern uguale a quello già applicato per il duplicato GC108: verifica orfanità + delete.
- Se in futuro servisse ripristinare ELBA come compagnia separata, la si potrà ricreare da Compagnie → Nuova Compagnia.
