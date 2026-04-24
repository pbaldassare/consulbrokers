

## Nascondere tab "Zone" da Tabelle di Base

### Problema
Nello screenshot la tab **"Zone"** (13) è visibile in `/tabelle-base` e attualmente selezionata (mostra l'intestazione "Zona" e una tabella vuota in caricamento). L'utente non la usa più e vuole nasconderla.

### Stato attuale
In `src/pages/TabelleBasePage.tsx` riga **970**:
```ts
{ value: "lookup_zone", label: "Zone", tableName: "lookup_zone", queryKey: "lookup-zone", title: "Zona", custom: "ordered" },
```

La tab punta alla tabella `lookup_zone` (13 record). Stesso pattern già usato per "Settori RCA" rimossa nello step precedente.

### Soluzione

**File modificato**: `src/pages/TabelleBasePage.tsx`
- Rimuovo la riga 970 dell'array delle tabelle disponibili.
- Se la tab "Zone" risulta selezionata di default in qualche stato iniziale, sposto il default sulla prima tab disponibile (es. `gruppi_ramo` o `rami`).

### Cosa NON tocco
- ❌ **Nessuna modifica DB**: la tabella `lookup_zone` resta nel database (potrebbe essere ancora referenziata da `clienti.zona` o altri campi statistici). Solo nascondo la tab di gestione.
- ❌ Le altre tab (Gruppi Ramo, Rami, Usi RCA, Garanzie RCA, Gruppi Statistici, Gruppi Finanziari, Tipi Mandatario, Tipi Rinnovo, Filiali, Indotti, Attività, Settori, Contratti, Fasce Fatturato, Fasce Dipendenti, Risk Type, Tipo Documento, Conti Incasso) restano intatte.
- ❌ Nessun riferimento a `lookup_zone` viene rimosso dal resto del codice (form clienti, lookup, ecc.).

### Verifica
1. `/tabelle-base` → la tab "Zone 13" non appare più nell'elenco.
2. Le altre 18 tab restano funzionanti.
3. La tabella DB `lookup_zone` resta intatta (verificabile con `SELECT COUNT(*) FROM lookup_zone` → 13).

### Nota
Se in futuro vuoi nascondere anche altre tab inutilizzate (es. "Settori" 8, "Contratti" 0, "Risk Type" 0, "Conti Incasso" 0 — quelle a 0 record probabilmente non servono), fammelo sapere e le tolgo in un colpo solo.

