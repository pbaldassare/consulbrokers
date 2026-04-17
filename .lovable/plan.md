
## Richiesta

Creare un nuovo account admin con:
- **Email**: `pscarpelli@consulbrokers.it`
- **Password**: `Leone123!`
- **Ruolo**: `admin`

E segnarlo correttamente nel database (auth.users + profiles + user_roles).

## Approccio

Non possiamo creare utenti auth via SQL diretto (il sistema auth è gestito da Supabase). Useremo l'edge function esistente `provision-user` (o `create-user`) che già gestisce il flusso completo:

1. Crea utente in `auth.users` con password
2. Inserisce profilo in `profiles` con ruolo `admin`
3. Inserisce in `user_roles` con role `admin`
4. Logga l'attività in `log_attivita`

## Verifiche da fare

1. Controllare se l'email `pscarpelli@consulbrokers.it` esiste già in `profiles` (per evitare duplicati)
2. Verificare quale edge function è la più adatta tra `provision-user` e `create-user`
3. Verificare che `nome` e `cognome` siano richiesti — proporre `Pasquale` / `Scarpelli` (nome dedotto dall'email `pscarpelli`)

## Esecuzione

Una volta in default mode:
1. Query `profiles` per verificare assenza duplicati su quell'email
2. Chiamata diretta SQL **non possibile** per creare auth user → uso script che invoca l'edge function `create-user` con service role, oppure script Deno locale che usa `auth.admin.createUser`
3. Alternativa più pulita: eseguire uno script una-tantum tramite `supabase--insert` non funziona per `auth.users` — quindi useremo una **migration con plpgsql che chiama direttamente le tabelle interne** NON è permesso.

**Strada corretta**: creare uno script che gira via `code--exec` chiamando l'edge function `create-user` con un token admin valido, OPPURE temporaneamente esporre un endpoint. 

**Strada più semplice e affidabile**: creo una nuova edge function una-tantum `bootstrap-admin` (o riuso `create-user` invocandola con service_role direttamente da uno script che gira nel sandbox usando `SUPABASE_SERVICE_ROLE_KEY`).

### Piano definitivo

1. **Script Deno/Node** in `code--exec` che:
   - Usa `SUPABASE_SERVICE_ROLE_KEY` (disponibile in secrets) e `SUPABASE_URL`
   - Chiama `auth.admin.createUser({ email, password, email_confirm: true })`
   - Inserisce riga in `profiles` con `ruolo='admin'`, `attivo=true`, nome/cognome
   - Inserisce riga in `user_roles` con `role='admin'`
   - Inserisce log in `log_attivita`

2. **Verifica finale** con `supabase--read_query` per confermare la presenza in tutte e 3 le tabelle.

### Domanda di chiarimento

Confermi i dati anagrafici del nuovo admin?
- **Nome**: `Pasquale`
- **Cognome**: `Scarpelli`
- **Ufficio (Sede)**: nessuno (admin globale)

Oppure preferisci diversi? Se confermi procedo con questi.
