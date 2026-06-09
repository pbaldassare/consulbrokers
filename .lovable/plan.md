## Auto-compilazione CF in ClienteDetail (anagrafica)

Oggi nella scheda cliente esiste solo il pulsante "Compila da CF". Lo replico come trigger **automatico** (stesso comportamento del modal "Nuovo Cliente"): appena il CF privato raggiunge 16 caratteri validi, vengono valorizzati `sesso`, `data_nascita`, `comune_nascita`, `provincia_nascita`, `luogo_nascita`.

### Modifica
File: `src/pages/ClienteDetail.tsx`
- Aggiungere un `useEffect` che osserva `ef.codice_fiscale` quando `isPrivato && editMode`:
  - Se lunghezza === 16 e `parseCF` restituisce un risultato valido e `lastAutoFilledCFRef.current !== cf`, chiama `handleCFAutoFill(cf)`.
- `handleCFAutoFill` esiste già e fa anche `toast.info` la prima volta — viene riusato così com'è.
- Il pulsante "Compila da CF" resta per chi vuole ri-forzare il refill manualmente.

Effetto: digitando/incollando un CF in scheda cliente, data di nascita, sesso e luogo vengono ricavati subito, senza dover cliccare il bottone.

### File toccati
- `src/pages/ClienteDetail.tsx` — aggiunta di un `useEffect` (~5 righe)
