<final-text>
Piano operativo per forzare davvero l’account `segreteria@consulbrokers.it` e farlo comparire correttamente in database, con accessi solo alle aree richieste.
</final-text>

1. Verifica e ripristino account in Supabase
- Controllare se l’utente esiste già in `auth.users`, `profiles` e `user_roles`.
- Se esiste già in Auth: forzare password a `Leone123!` e `email_confirm = true`.
- Se non esiste: crearlo.
- Poi fare upsert del profilo in `profiles` con:
  - `nome: Segreteria`
  - `cognome: Consulbrokers`
  - `email: segreteria@consulbrokers.it`
  - `ruolo: ufficio`
  - `attivo: true`
  - `ufficio_id`: Napoli
- Infine fare upsert in `user_roles` con ruolo `ufficio`.
- La logica sarà idempotente: se rilanciata, non deve creare duplicati né lasciare record spezzati.

2. Sistemare il provisioning attuale
- L’attuale `supabase/functions/provision-user/index.ts` è hardcoded e non gestisce bene i casi “utente già esistente / profilo mancante / ruolo mancante”.
- Lo renderò un provisioning di riparazione:
  - crea se manca
  - aggiorna se esiste
  - riallinea sempre `profiles` + `user_roles`
- Così l’account lo “forziamo” davvero e poi lo troviamo in database in stato consistente.

3. Correggere il modello permessi per rispettare esattamente la tua richiesta
Dalla lettura del codice ho trovato questi problemi:
- “Portafoglio” e “Trattative” oggi condividono lo stesso permesso (`titoli`)
- “Anagrafiche Utenti” oggi dipende da `dashboard`
- varie route non sono realmente protette per permesso, quindi nascondere la sidebar non basta

Per questo farò:
- separazione permesso `trattative` da `titoli`
- spostamento di “Anagrafiche Utenti” su un permesso dedicato `anagrafiche`
- mantenimento di:
  - `titoli: true` solo per Portafoglio
  - `portafoglio: true` per Archivio Documentale
  - `contabilita: true`
  - `anagrafiche: true`
- senza accendere `dashboard`, `trattative`, `sinistri`, `cfo_area`, `provvigioni`, `impostazioni`

4. Applicare protezioni vere alle route
File da toccare:
- `src/components/AppSidebar.tsx`
- `src/routes/archivi.tsx`
- `src/routes/portafoglio.tsx`
- `src/routes/contabilita.tsx`
- `src/routes/sistema.tsx`
- eventuale supporto in `RoleGuard.tsx`

Obiettivo:
- l’utente vede solo:
  - Portafoglio
  - Archivio Documentale
  - Contabilità
  - Anagrafiche Utenti
- se prova ad aprire URL non consentiti, viene bloccato e reindirizzato

5. Sistemare il post-login
- Oggi il login porta a `/`.
- Se togliamo `dashboard`, quell’utente non deve atterrare in una home non prevista.
- Aggiornerò il redirect post-login per mandarlo alla prima area consentita, ad esempio `/portafoglio/attive`.

6. Validazione finale
Farò questi controlli finali:
- record presente in `auth.users`
- record presente in `profiles`
- record presente in `user_roles`
- login funzionante con:
  - email: `segreteria@consulbrokers.it`
  - password: `Leone123!`
- sidebar visibile solo con le 4 aree richieste
- accesso diretto via URL alle aree escluse bloccato

Dettagli tecnici
- Risorse coinvolte: `auth.users`, `profiles`, `user_roles`, `uffici`
- Nessun cambio a valori DB dei ruoli esistenti; il ruolo resta `ufficio`
- Il punto critico non è solo creare l’utente: è allineare provisioning + permessi + route, altrimenti l’account esiste ma non rispetta davvero quello che hai chiesto
