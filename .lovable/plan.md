

## Piano: Popup di conferma "Metti a Cassa" con date, tipo pagamento e disclaimer

### Cosa cambia
Il pulsante "Metti a Cassa" non eseguirà più direttamente la mutazione. Aprirà un Dialog di conferma con:

**Campi nel popup:**
1. **Data Messa a Cassa** — input date, default oggi
2. **Data Pagamento** — input date, default oggi
3. **Data Decorrenza Rinnovo** — input date, default oggi
4. **Tipo Pagamento** — select con opzioni: Contanti, Carta di Credito, Bonifico
5. **Banca** (visibile solo se Bonifico) — select con lista banche italiane comuni (Intesa Sanpaolo, UniCredit, BNL, BPER, Banco BPM, MPS, Crédit Agricole, Poste Italiane, ecc.)
6. **Disclaimer rosso**: "Attenzione: questa operazione è irreversibile. Una volta confermata, non sarà possibile annullare l'incasso."

**Pulsanti:** Annulla / Conferma Incasso

### Logica
- Click "Metti a Cassa" → apre Dialog (stato locale `cassaDialogOpen`)
- Conferma → chiama `changeStatoMutation` passando le date scelte + `tipo_pagamento` + eventuale banca
- La mutation salva `data_messa_cassa`, `data_pagamento`, `data_decorrenza_rinnovo`, `tipo_pagamento` nel record `titoli`

### File coinvolto
- **Modifica**: `src/pages/TitoloDetail.tsx`
  - Aggiungere stato per il dialog e i campi form
  - Sostituire il click diretto con apertura dialog
  - Modificare `changeStatoMutation` per accettare le date e tipo pagamento dal form
  - Aggiungere il Dialog con i campi e il disclaimer

