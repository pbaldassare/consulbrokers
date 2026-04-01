

## Piano: Aggiornare stato titoli a "incassato" fino al 28/02/2026

### Nota importante
Il 2026 **non è bisestile** — febbraio ha 28 giorni, non 29. Uso quindi il 28/02/2026 come data limite.

### Dati coinvolti
- **708 titoli** in stato "attivo" con `data_scadenza ≤ 2026-02-28`
- **12 titoli** in stato "sospeso" con `data_scadenza ≤ 2026-02-28`
- Totale: **720 titoli** da portare a "incassato"

### Operazione

Un singolo UPDATE via insert tool:

```sql
UPDATE titoli
SET stato = 'incassato',
    importo_incassato = premio_lordo,
    data_incasso = data_scadenza
WHERE data_scadenza <= '2026-02-28'
  AND stato IN ('attivo', 'sospeso');
```

- `stato` → `'incassato'`
- `importo_incassato` → copiato da `premio_lordo` (incasso totale)
- `data_incasso` → copiato da `data_scadenza` (data realistica di incasso)

### Risultato atteso
- I KPI della dashboard CFO (Premi Incassati, Provvigioni) e i grafici "Premi per Compagnia" mostreranno dati reali
- I report e le estrazioni filtrate per stato "incassato" funzioneranno correttamente

### File coinvolti

| File | Azione |
|------|--------|
| Nessun file frontend | Solo operazione dati via insert tool |

