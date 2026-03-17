

## Piano: Pagina Gestione Utenti + Creazione 6 Utenti Demo

### Cosa faremo

1. **Modificare la Edge Function `create-user`** per accettare un parametro `password` opzionale (fallback a "Temp123!")
2. **Creare pagina `GestioneUtenti.tsx`** con:
   - Lista utenti dal DB (profiles + user_roles)
   - Filtri per ruolo e stato
   - Dialog per creare nuovo utente (nome, cognome, email, ruolo, password, ufficio)
   - Dialog per modificare utente esistente (ruolo, permessi, attivo/disattivo)
   - Assegnazione ruolo tramite update su `profiles.ruolo` + `user_roles`
3. **Aggiungere rotta `/gestione-utenti`** in App.tsx protetta da RoleGuard admin
4. **Aggiungere voce sidebar** "Gestione Utenti"
5. **Creare 6 utenti demo** tramite la Edge Function (uno per ruolo):
   - admin@consul.ite (admin)
   - ufficio@consul.ite (ufficio)
   - produttore@consul.ite (produttore)
   - contabilita@consul.ite (contabilita)
   - cfo@consul.ite (cfo)
   - cliente@consul.ite (cliente)
   - Tutti con password: Leone123!

### Dettagli tecnici

**Edge Function update**: Aggiungere campo `password` nel body della request, usarlo al posto di `tempPassword` se fornito.

**GestioneUtenti.tsx**: Query `profiles` con join logico su `user_roles`. Tabella con colonne: Nome, Email, Ruolo, Stato, Azioni. Dialog di modifica con select ruolo e switch attivo/disattivo. Per la modifica ruolo, update sia `profiles.ruolo` che `user_roles` (delete vecchio + insert nuovo).

**Creazione utenti**: Dopo il deploy della edge function aggiornata, invocherò la funzione 6 volte per creare tutti gli utenti. Siccome non c'è ancora un admin autenticato, dovrò usare un approccio alternativo: creare una edge function dedicata `seed-users` che usa il service role key direttamente, senza richiedere autenticazione admin, da invocare una sola volta.

### File coinvolti
- **Modificato**: `supabase/functions/create-user/index.ts` (supporto password custom)
- **Nuovo**: `src/pages/GestioneUtenti.tsx`
- **Nuovo**: `supabase/functions/seed-users/index.ts` (per creare i 6 utenti demo)
- **Modificato**: `src/App.tsx` (rotta)
- **Modificato**: `src/components/AppSidebar.tsx` (voce menu)

