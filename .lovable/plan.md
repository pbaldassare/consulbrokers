

## Piano: Pulire i titoli vecchi da E/C Compagnia

### Situazione attuale
- **720 titoli** con `stato = 'incassato'` e `data_messa_cassa = '2026-03-31'` — sono dati importati massivamente, NON passati dal flusso "Incassi e Coperture"
- **3 titoli** con `data_messa_cassa` del 14-15 aprile 2026 — questi sono quelli reali fatti attraverso il flusso corretto

### Soluzione
Una migration SQL che resetta i 720 titoli vecchi:
- `stato` torna a `'attivo'` (erano polizze attive prima dell'import)
- `data_messa_cassa` torna a `NULL`

```sql
UPDATE titoli
SET stato = 'attivo',
    data_messa_cassa = NULL
WHERE stato = 'incassato'
  AND data_messa_cassa = '2026-03-31';
```

Dopo questa operazione, E/C Compagnia mostrerà solo le 3 righe reali di aprile 2026 (raggruppate per le 3 compagnie corrispondenti).

### Nessuna modifica al codice frontend
La query già filtra per `stato = 'incassato'` — basta pulire i dati nel DB.

