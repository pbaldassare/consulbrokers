

## Piano: Creare utente segreteria@consulbrokers.it via script diretto

### Problema
La Edge Function `create-user` richiede un token admin, ma non sei loggato nella preview.

### Soluzione
Eseguire uno script Node.js che usa la **service role key** (già configurata come secret) per creare l'utente direttamente via Supabase Admin API, bypassando l'autenticazione.

### Lo script farà:
1. **Creare l'utente** in `auth.users` con email `segreteria@consulbrokers.it` e password `Leone123!`
2. **Inserire il profilo** in `profiles` con ruolo `ufficio`, ufficio_id = Napoli (`f5163c49-1e7e-48b5-9ac6-5494a9d4ce4a`), e `permessi_json` con dashboard, titoli, portafoglio, contabilita, anagrafiche abilitati
3. **Assegnare il ruolo** `ufficio` in `user_roles`

### Dettagli tecnici
- Usa `SUPABASE_SERVICE_ROLE_KEY` dall'environment (già presente)
- Chiama `supabase.auth.admin.createUser()` con `email_confirm: true`
- Nessuna modifica al codice del progetto

