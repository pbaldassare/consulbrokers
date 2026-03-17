

## Piano: Cambiare dominio email da @consul.ite a @consul.it

### Problema
I 6 utenti demo hanno email con dominio `@consul.ite` invece di `@consul.it`. Serve aggiornare sia i dati nel database (auth.users + profiles) sia il codice della edge function seed-users.

### Interventi

1. **Aggiornare `supabase/functions/seed-users/index.ts`** — Cambiare tutte le email da `@consul.ite` a `@consul.it`

2. **Aggiornare le email degli utenti esistenti nel database** — Modificare la edge function seed-users per includere una logica di "update email" che:
   - Per ogni utente, cerca il profilo con la vecchia email `@consul.ite`
   - Aggiorna l'email in `profiles` a `@consul.it`
   - Aggiorna l'email in `auth.users` tramite `adminClient.auth.admin.updateUserById()` 
   - Se l'utente non esiste con la vecchia email, lo crea con la nuova email

3. **Deploy e invocazione** della edge function aggiornata

### File coinvolti
- **Modificato**: `supabase/functions/seed-users/index.ts`

