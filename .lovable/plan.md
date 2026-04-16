

## Piano: Ripristinare il Carico di Aprile a 16 polizze / €89.951,50

### Problema
4 polizze con scadenza aprile hanno stato `annullato` invece di `attivo`. Il Carico del Mese filtra per `stato IN ('attivo','incassato')`, quindi mostra solo 12 polizze (€87.190,44) invece delle 16 previste (€89.951,50).

### Soluzione
Eseguire un UPDATE per riportare le 4 polizze a stato `attivo`:

```sql
UPDATE titoli SET stato = 'attivo'
WHERE id IN (
  'd046ffeb-2ed1-43cc-ba03-a07cfb838804',  -- 332437571
  '66c6cf18-5fc9-4a29-b593-133f2eabe70d',  -- 332437574
  '41feab18-7d73-4818-aff8-8a343e6780e9',  -- 204366651
  'd97f56e6-4ad1-4e6d-aa85-d756b1416501'   -- 332434490
);
```

### Dettagli
- Nessuna modifica al codice frontend
- L'update va eseguito tramite migrazione SQL
- Dopo il ripristino: 16 polizze, €89.951,50 — conforme al file Excel di riferimento

