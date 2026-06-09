## Validazione fiscale per tipo cliente

Bug: nel cliente Privato compare l'errore "Partita IVA: La P.IVA deve contenere solo cifre" perché il salvataggio valida **sempre** tutti i campi fiscali, anche quelli non pertinenti al tipo cliente (un Privato può avere un valore vecchio/sporco in `partita_iva` o `codice_fiscale_azienda`).

### Fix
File: `src/pages/ClienteDetail.tsx` (riga ~1480, dentro `saveDetailsMutation`).

Sostituire la chiamata `assertFiscalValid([...])` con una versione gated per tipologia:
- Se **privato** → valida solo `codice_fiscale` (cf16).
- Se **azienda/ente** → valida `partita_iva` (piva) e `codice_fiscale_azienda` (cf-azienda).

Così nel Privato la P.IVA residua non blocca più il salvataggio; viceversa nei soggetti business resta protetta.

### File toccati
- `src/pages/ClienteDetail.tsx` — ~5 righe nel mutationFn
