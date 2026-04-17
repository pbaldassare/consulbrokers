

## Diagnosi

| Card | Mostra | DB reale (su `titoli`) | Causa |
|---|---|---|---|
| Scadenze del Mese | 11 | **16** | Query usa `v_portafoglio_titoli` che filtra/esclude alcuni titoli vs `titoli` diretta |
| Incassi del Mese | 0 | **2** (con `data_messa_cassa` ad aprile) | Stessa causa: la vista non espone bene `data_messa_cassa` |
| Carico del Mese | 0 | va sostituito con "Fuori Copertura" (3 titoli) | Logica errata (usa `data_effetto`) |

## Piano

### File toccati
- `src/hooks/useDashboardData.ts` — modifiche a `loadUfficio()`
- `src/pages/Dashboard.tsx` — rinominare card "Carico del Mese" → "Fuori Copertura"

### Modifiche `loadUfficio()`
1. **Sostituire `v_portafoglio_titoli` con la tabella `titoli` diretta** per le 3 query KPI (scadenze, incassi, fuori copertura). La vista filtra/aggrega e perde dei record. Le query restano semplici e usano i campi base di `titoli`.

2. **Scadenze del Mese**: 
   ```ts
   supabase.from("titoli").select("premio_lordo")
     .gte("data_scadenza", startOfMonth).lte("data_scadenza", endOfMonth)
     .in("stato", ["attivo", "incassato"]).limit(10000)
   ```
   → atteso **16**.

3. **Incassi del Mese** (Messe a Cassa): 
   ```ts
   supabase.from("titoli").select("premio_lordo")
     .gte("data_messa_cassa", startOfMonth).lte("data_messa_cassa", endOfMonth).limit(10000)
   ```
   → atteso **2**.

4. **Fuori Copertura** (sostituisce "Carico del Mese"):
   ```ts
   supabase.from("titoli").select("premio_lordo")
     .gte("data_scadenza", startOfMonth).lt("data_scadenza", oggi)
     .eq("stato", "attivo").is("data_messa_cassa", null).limit(10000)
   ```
   → atteso **3**.

5. Rinominare in `UfficioData`:
   - `caricoMeseCount/Importo` → `fuoriCoperturaCount/Importo`

### Modifiche `Dashboard.tsx`
- Card "Carico del Mese" → label **"Fuori Copertura"**, icona `AlertCircle`, variant `orange` (allerta), navigazione a `/portafoglio/carico` (lista titoli da gestire).

### Cosa NON cambia
- Le altre dashboard (admin, produttore, contabilita, cfo) restano intatte.
- I grafici "Incassi Mensili" e "Scadenze prossimi 30gg per Compagnia" restano sulla vista (non sono i KPI critici).

