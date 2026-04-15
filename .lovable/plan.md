

## Piano: Annulla Incasso solo per Admin con conferma password

### Cosa cambia

**1. Visibilità pulsante "Annulla Incasso"**
- Mostrare il pulsante solo se `isAdmin === true` (da `useAuth()`)
- Gli utenti non-admin non vedranno il pulsante

**2. Dialog di conferma con password**
- Click su "Annulla Incasso" → apre un nuovo Dialog (non esegue direttamente la mutazione)
- Il dialog contiene:
  - Disclaimer rosso: "Operazione riservata agli amministratori. Inserisci la tua password per confermare l'annullamento dell'incasso."
  - Campo password (input type="password")
  - Pulsanti: Annulla / Conferma Annullamento
- Alla conferma: verificare la password chiamando `supabase.auth.signInWithPassword({ email, password })` con l'email dell'utente corrente
- Se la password è corretta → eseguire `changeStatoMutation.mutate("attivo")`
- Se errata → mostrare toast di errore "Password non corretta"

**3. Stessa logica per PortafoglioCaricoPage.tsx**
- Il bulk "Annulla Incasso" va anch'esso protetto con `isAdmin` check

### File coinvolti
- **Modifica**: `src/pages/TitoloDetail.tsx` — aggiungere `useAuth()`, condizione `isAdmin`, dialog password
- **Modifica**: `src/pages/PortafoglioCaricoPage.tsx` — proteggere bulk annulla con `isAdmin`

