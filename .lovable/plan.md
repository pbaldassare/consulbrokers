Rendo il campo **CIG/Rif.** sempre visibile nella sezione Contratto della pagina Immissione Polizza, accanto a Vincolo, mantenendo tutte le regole già presenti:

- Validazione esistente: 10 caratteri alfanumerici (`isValidCigWithFlag` + `normalizeCig`).
- Flag **"CIG temporaneo (formato libero)"** che sblocca il formato libero fino a 40 caratteri.
- Asterisco rosso + bordo destructive + messaggio "Obbligatorio per Enti" e blocco salvataggio (`saveBlockReason`) **solo quando il cliente è di tipo Ente** (`cigObbligatorio`).
- Per clienti privati/azienda: campo opzionale, nessun asterisco, nessun errore se vuoto.

Modifica unica in `src/pages/ImmissionePolizzaPage.tsx`:
- Rimuovo il wrapper `{cigObbligatorio && (...)}` attorno al blocco CIG.
- Cambio le classi del grid contenitore a `grid-cols-1 md:grid-cols-2` fisso così CIG e Vincolo restano sempre affiancati.
- L'asterisco, il bordo rosso e l'hint "Obbligatorio per Enti" restano condizionati a `cigObbligatorio`; il messaggio di formato non valido resta condizionato a `cigRif` non vuoto.

Nessuna modifica al database, al payload di salvataggio o alla logica `saveBlockReason`.