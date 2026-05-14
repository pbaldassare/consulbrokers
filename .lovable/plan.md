## Tabella "Polizze del cliente" — pulizia colonne

File: `src/pages/ClienteDetail.tsx`

### Modifiche
1. Rimuovere colonna **Incassato €** (header + celle madre + celle figlia).
2. Colonna **Data Incasso** → mostrare `data_messa_cassa` se valorizzato, altrimenti fallback a `data_incasso`. Etichetta colonna invariata ("Data Incasso"). Quando assenti → `—`.
3. Aggiungere `data_messa_cassa` al `select` della query `polizze_cliente` e rimuovere `importo_incassato` (non più usato).

### Fuori scopo
- Logica messa a cassa, badge stato, altre tab/pagine.
- Nessuna migration DB.