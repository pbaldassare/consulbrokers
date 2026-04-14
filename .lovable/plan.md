

## Piano: Aggiungere sezione Messa a Cassa nel dettaglio polizza

### Obiettivo
Sotto la card "Operazioni" in `TitoloDetail.tsx`, aggiungere una nuova card "Messa a Cassa" che mostra lo stato incasso e permette di mettere a cassa / annullare incasso direttamente dalla singola polizza.

### Cosa viene aggiunto

**Nuova card "Messa a Cassa"** (visibile solo per polizze attive o incassate):
- Se la polizza è **attiva**: pulsante "Metti a Cassa" che imposta `stato = 'incassato'` e le 3 date (data_messa_cassa, data_pagamento, data_decorrenza_rinnovo) a oggi
- Se la polizza è **incassata**: mostra le 3 date in formato leggibile + pulsante "Annulla Incasso" per fare revert
- Le date vengono mostrate sempre: Data Messa a Cassa, Data Pagamento, Data Decorrenza Rinnovo

### Dettagli tecnici
- File: `src/pages/TitoloDetail.tsx`
- Aggiornare `changeStatoMutation` per gestire anche le 3 date quando si passa a "incassato" (update con data_messa_cassa, data_pagamento, data_decorrenza_rinnovo = today) e azzerarle quando si fa revert ad "attivo"
- La card si posiziona subito dopo la card Operazioni (riga ~306)
- Stile coerente con le altre card della pagina

