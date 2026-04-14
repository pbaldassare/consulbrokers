

## Piano: Fix data_messa_cassa mancante sulle polizze incassate

### Problema
Le 132 provvigioni commerciali esistono in `provvigioni_generate` (€8.111), ma tutte le polizze incassate collegate hanno `data_messa_cassa = NULL`. La query della pagina filtra per mese usando quel campo con un `!inner` join, quindi tutte vengono escluse.

### Soluzione

**1. Backfill `data_messa_cassa` per polizze già incassate**
- Migrazione SQL: per tutti i titoli con `stato = 'incassato'` e `data_messa_cassa IS NULL`, impostare `data_messa_cassa` a un valore ragionevole. Opzioni:
  - Usare `calcolata_il` dalla provvigione collegata (data del ricalcolo)
  - Usare `updated_at` del titolo (data dell'ultimo aggiornamento, probabilmente la messa a cassa)
  - Usare la data odierna come fallback
- La migrazione più sicura: `UPDATE titoli SET data_messa_cassa = updated_at::date WHERE stato = 'incassato' AND data_messa_cassa IS NULL`

**2. Nessuna modifica al codice**
`PortafoglioCaricoPage.tsx` già popola `data_messa_cassa` per le nuove messe a cassa. Serve solo il backfill per i dati storici.

### File coinvolti
- **Migrazione SQL**: backfill `data_messa_cassa` su titoli incassati

