## Fix "Rendered more hooks" crash in ClienteDetail

Causa: il `useEffect` di auto-CF è stato inserito **dopo** l'early return `if (!cliente) return null;` (riga 1627). Al primo render `cliente` è `undefined` → l'effect non viene mai registrato; quando i dati arrivano viene aggiunto un hook in più rispetto al render precedente → React crash.

### Fix
File: `src/pages/ClienteDetail.tsx`
- Spostare il blocco `useEffect([ef.codice_fiscale, isPrivato, editMode])` (righe ~1680-1689) **prima** del `if (!cliente) return null;` (riga 1627). 
- All'interno dell'effect aggiungere una guard `if (!cliente) return;` così resta inerte finché il cliente non è caricato.
- `handleCFAutoFill` può restare dov'è (non è un hook), ma per evitare TDZ verrà richiamato dentro l'effect usando una ref/funzione locale equivalente: spostiamo `handleCFAutoFill` insieme all'effect sopra l'early return.

### File toccati
- `src/pages/ClienteDetail.tsx` — riordino di ~25 righe, nessuna modifica funzionale.
