## Obiettivo
Allineare **Portafoglio › Carico** alla regola "l'incasso si fa solo dalla quietanza": nella lista Carico la **polizza madre con rate successive** NON deve comparire (non è incassabile). Devono comparire solo le righe realmente da mettere a cassa:

- Polizze "monorata" (madri senza quietanze successive) → SI
- Quietanze (rate 2..N) → SI
- Regolazioni → SI (invariato)
- **Madri che hanno almeno una rata successiva** → NO (nascoste dalla lista e dai KPI in alto)

## Cosa cambia

### 1. Vista `v_portafoglio_quietanze` (DB)
Migrazione `CREATE OR REPLACE VIEW` per aggiungere una sola colonna:

```sql
EXISTS (
  SELECT 1
  FROM titoli t2
  WHERE t2.sostituisce_polizza = t.numero_titolo
) AS ha_rate_successive
```

Nessun'altra modifica alla view. GRANT invariati.

### 2. `src/pages/PortafoglioCaricoPage.tsx`
- Aggiungo `ha_rate_successive` alla `select(...)` (sia query lista che query totali).
- Applico un filtro server-side che **esclude le madri-con-rate**:
  ```ts
  // escludi madri (sostituisce_polizza IS NULL) che hanno figli (ha_rate_successive = true)
  q = q.or("sostituisce_polizza.not.is.null,ha_rate_successive.eq.false");
  ```
  Si applica in `useQuery` lista, in `useQuery` totaleData e nella query "tutte da incassare" usata altrove nel file (riga ~222), in modo che KPI e selezione massiva restino coerenti.
- Le card KPI in alto (numero/totale polizze, numero/totale quietanze, totale da incassare) ricalcolano sui dati filtrati → automaticamente coerenti.

### 3. Pagine NON toccate
- `PortafoglioAttivePage` e `PortafoglioStoricoPage`: nessuna modifica (lì le madri restano visibili come "anagrafica contratto").
- `TitoloDetail`: già aggiornata (callout "Vai alla prima rata da incassare").
- Schema dati, trigger, generazione quietanze, provvigioni: invariati.

## File toccati
- **Nuovo**: `supabase/migrations/<timestamp>_v_portafoglio_quietanze_ha_rate.sql` (CREATE OR REPLACE VIEW + GRANT).
- **Modificato**: `src/pages/PortafoglioCaricoPage.tsx` (select + filtro OR su 3 query).

## Verifica
1. Caso 332437574 in screenshot (madre senza cliente in Carico): se ha figli quietanza → sparisce dalla lista; le sue rate restano visibili come righe Quietanza.
2. Polizza annuale singola rata → resta visibile come "Polizza" e si incassa da Carico.
3. Regolazioni (`/RG1`) → restano visibili.
4. KPI in alto: il conteggio polizze cala del numero di madri-con-rate nascoste; il conteggio quietanze invariato.
