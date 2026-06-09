## Rapporti N:N duplicati nel dialog "Agenzie collegate"

Causa: la tabella `compagnia_rapporti` contiene 17 righe in cui `compagnia_id` punta a un'agenzia che **appartiene già allo stesso `gruppo_compagnia_id` del rapporto**. Sono rapporti "auto-referenziali" verso la stessa Compagnia principale → vengono mostrati sia nella sezione "Agenzie principali (1:N)" sia nei "Rapporti aggiuntivi N:N". Per definizione, una plurimandataria è un'agenzia di un **altro** gruppo data in gestione.

### Pulizia dati
Migrazione one-shot:
```sql
DELETE FROM public.compagnia_rapporti cr
USING public.compagnie c
WHERE c.id = cr.compagnia_id
  AND c.gruppo_compagnia_id = cr.gruppo_compagnia_id;
```
(17 righe eliminate, incluse le 2 di GENERALI ITALIA mostrate.)

### Prevenzione futura
Trigger BEFORE INSERT/UPDATE su `compagnia_rapporti` che blocca l'inserimento se `compagnia.gruppo_compagnia_id = NEW.gruppo_compagnia_id`, con messaggio chiaro ("Un'agenzia non può avere un rapporto N:N con la propria Compagnia di appartenenza").

### Guardia frontend (difesa in profondità)
In `src/pages/CompagnieList.tsx` (query `rapporti-per-gruppo`, riga ~850) aggiungere un filtro post-fetch che esclude i record dove `compagnie.gruppo_compagnia_id === gruppoId`. Stesso filtro nella query di conteggio `compagnia_rapporti_counts` (riga ~1400) se conta queste righe.

### File toccati
- 1 migrazione SQL (DELETE + trigger)
- `src/pages/CompagnieList.tsx` — filtro client su 2 query
