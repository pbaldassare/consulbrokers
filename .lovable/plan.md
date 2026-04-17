
## Richiesta

I rinnovi futuri (titoli con `data_decorrenza_rinnovo` futura, non ancora messi a cassa) devono apparire anche nella vista **"Carico del Mese"** quando la loro decorrenza cade nel mese corrente (es. aprile 2026). Oggi probabilmente vengono filtrati fuori perché la query del Carico del Mese si basa su `data_effetto`/`data_scadenza` e non considera `data_decorrenza_rinnovo`.

## Investigazione

Devo verificare:
1. `src/pages/PortafoglioCaricoPage.tsx` — quale criterio usa oggi (probabilmente `data_effetto` nel mese o `data_scadenza` nel mese, su `v_portafoglio_titoli`).
2. Come popolare la lista in modo che includa anche i rinnovi futuri con `data_decorrenza_rinnovo` nel mese corrente e `data_messa_cassa IS NULL`.
3. Se la vista `v_portafoglio_titoli` espone già `data_decorrenza_rinnovo` (memory `portfolio-view-calculated-fields` lo conferma per il portafoglio attivo, va verificato).

## Piano

### File toccati
- `src/pages/PortafoglioCaricoPage.tsx` — allargare il criterio per includere i rinnovi futuri del mese corrente.

### Logica

La pagina "Carico del Mese" deve mostrare TUTTI i titoli che hanno una "decorrenza nel mese corrente" e NON sono ancora stati messi a cassa, considerando come decorrenza:

- `data_effetto` (immissione/nuova polizza), oppure
- `data_decorrenza_rinnovo` (rinnovo futuro/in essere)

Filtro finale (OR):
```sql
WHERE data_messa_cassa IS NULL
  AND stato IN ('attivo','sospeso')
  AND (
    (data_effetto >= startOfMonth AND data_effetto <= endOfMonth)
    OR
    (data_decorrenza_rinnovo >= startOfMonth AND data_decorrenza_rinnovo <= endOfMonth)
  )
```

In codice: poiché supabase-js non supporta direttamente OR su due range, uso `.or("and(data_effetto.gte.X,data_effetto.lte.Y),and(data_decorrenza_rinnovo.gte.X,data_decorrenza_rinnovo.lte.Y)")`.

### UI

- Aggiungere una colonna/badge **"Tipo"** nella tabella Carico del Mese: "Nuova" (se la decorrenza è `data_effetto`) vs "Rinnovo" (se la decorrenza è `data_decorrenza_rinnovo`), per chiarezza operativa.
- Mostrare la **data di decorrenza effettiva** (la più rilevante: `data_decorrenza_rinnovo` se presente e nel mese, altrimenti `data_effetto`).

### Allineamento Dashboard

Verificare se anche la card "Fuori Copertura" / KPI ufficio in `useDashboardData.ts` deve includere i rinnovi futuri non incassati. **Default**: lascio "Fuori Copertura" come definita (scaduti non incassati) — i rinnovi futuri NON sono "fuori copertura" finché non arriva la decorrenza. Ma il conteggio "Carico del Mese" sulla pagina lista cambia.

### Cosa NON cambia
- Stati DB e logica messa a cassa.
- Le altre viste (Attive, Storico) e KPI.
