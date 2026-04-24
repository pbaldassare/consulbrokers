

## Nascondere tab "Settori RCA" da Tabelle di Base

### Problema
Nello screenshot la tab **"Settori RCA"** (16) è ancora visibile in `/tabelle-base`, anche se la tabella `rca_settori` è stata eliminata dal DB nello step precedente. La tab mostra "Nessun elemento inserito" perché la query fallisce silenziosamente sulla tabella inesistente.

### Causa
In `src/pages/TabelleBasePage.tsx` l'entry `{ value: "rca_settori", label: "Settori RCA", ... }` non è stata rimossa dall'array delle tabelle disponibili.

### Soluzione

**File modificato**: `src/pages/TabelleBasePage.tsx`
- Rimuovo l'entry `rca_settori` dall'array delle tabelle base (la riga che la dichiara nella lista delle tab disponibili).
- Se è la tab attualmente selezionata di default in qualche stato, sposto il default su `rami` o `rca_usi`.

### Verifica
1. `/tabelle-base` → la tab "Settori RCA 16" non appare più nell'elenco.
2. Le altre tab (Gruppi Ramo, Rami, Usi RCA, Garanzie RCA, ecc.) restano funzionanti.
3. Nessun errore console.

### Cosa NON tocco
- ❌ Nessuna modifica DB (la tabella è già stata eliminata).
- ❌ Nessun'altra tab.

