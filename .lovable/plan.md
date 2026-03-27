

## Piano: Mostrare aliquote tasse nella gestione Rami

### Cosa fare

Aggiungere i campi `aliquota_tasse_ramo` e `aliquota_tasse_ard` sia nella **tabella** che nel **dialog di modifica/creazione** del tab Rami in `src/pages/TabelleBasePage.tsx`.

### Modifiche in `src/pages/TabelleBasePage.tsx` (RamiTab)

**1. Stato — aggiungere due state variables (~riga 152):**
- `aliquotaRamo` (string, default "0")
- `aliquotaArd` (string, default "0")

**2. Payload save (~riga 176):**
- Aggiungere `aliquota_tasse_ramo: parseFloat(aliquotaRamo) || 0` e `aliquota_tasse_ard: parseFloat(aliquotaArd) || 0`

**3. openNew / openEdit (~riga 213-214):**
- Reset/popolare i nuovi campi

**4. Colonne tabella (~righe 227-231):**
- Aggiungere due `<TableHead>`: "% Tasse Ramo" e "% Tasse ARD"
- Aggiungere due `<TableCell>` corrispondenti nelle righe (~riga 241)
- Aggiornare il `colSpan` nei messaggi vuoto/caricamento

**5. Dialog (~righe 266-279):**
- Aggiungere due campi `<Input type="number">` per le aliquote, dopo il campo Gruppo Ramo

### Risultato
- Le aliquote saranno visibili nella tabella rami
- Saranno editabili dal dialog di creazione/modifica
- Nessuna migrazione necessaria (le colonne esistono già nel DB)

