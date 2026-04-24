

## Nascondere tab "Risk Type" da Tabelle di Base

### Problema
Nello screenshot la tab **"Risk Type"** (0 record) è visibile in `/tabelle-base` e mostra "Nessun elemento inserito". L'utente non la usa e vuole nasconderla.

### Soluzione

**File modificato**: `src/pages/TabelleBasePage.tsx`
- Rimuovo l'entry `risk_type` (o nome equivalente) dall'array delle tabelle disponibili.
- Stesso pattern già usato per "Settori RCA" e "Zone".

### Cosa NON tocco
- ❌ **Nessuna modifica DB**: la tabella resta nel database come fallback (è già vuota, ma potrebbe essere referenziata).
- ❌ Le altre tab restano intatte.

### Verifica
1. `/tabelle-base` → la tab "Risk Type 0" non appare più nell'elenco.
2. Le altre tab (Gruppi Ramo, Rami, Usi RCA, Garanzie RCA, Gruppi Statistici, Gruppi Finanziari, Tipi Mandatario, Tipi Rinnovo, Filiali, Indotti, Attività, Settori, Contratti, Fasce Fatturato, Fasce Dipendenti, Tipo Documento, Conti Incasso) restano funzionanti.

### Suggerimento
Vedo nello screenshot altre tab a **0 record** che probabilmente non servono:
- **Contratti** (0)
- **Conti Incasso** (0)

Se vuoi le tolgo nello stesso colpo, dimmelo (rispondi "sì togli anche Contratti e Conti Incasso" oppure "no solo Risk Type").

