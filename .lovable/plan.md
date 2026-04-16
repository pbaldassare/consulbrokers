

## Piano: Fix polizze sparite dal Carico del Mese

### Causa
La vista `v_portafoglio_titoli` non include le 3 nuove colonne (`conferimento_gestito`, `fondi_ricevuti`, `data_conferimento_gestito`) aggiunte alla tabella `titoli`. La query PostgREST fallisce silenziosamente quando richiede colonne inesistenti dalla vista, restituendo 0 risultati.

### Soluzione

**1. Migrazione SQL** — Ricreare la vista aggiungendo le 3 colonne mancanti:
```sql
CREATE OR REPLACE VIEW v_portafoglio_titoli AS
  SELECT ... (tutte le colonne esistenti) ...,
    t.conferimento_gestito,
    t.fondi_ricevuti,
    t.data_conferimento_gestito,
    ... (rest of joins)
```

**2. Aggiornare i tipi TypeScript** — Aggiornare il tipo della vista in `types.ts` per includere le nuove colonne.

### File coinvolti
- Nuova migrazione SQL (1 file)
- `src/integrations/supabase/types.ts` — aggiungere colonne alla vista

Nessuna modifica al codice delle pagine: le query già richiedono queste colonne.

