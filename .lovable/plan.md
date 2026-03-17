

## Analisi dei Problemi Riscontrati

Ho analizzato il sistema di autenticazione, logging e ruoli. Ecco i problemi identificati:

### Problema 1: Nessuna pagina di Login/Logout
Non esiste una pagina di login. L'app assume che l'utente sia sempre autenticato, ma senza un flusso di autenticazione reale:
- `profile` è sempre `null` per utenti non autenticati
- La sidebar risulta vuota (tutti i `hasPermission()` ritornano `false`)
- Il `RoleGuard` fa redirect su `/` per ogni rotta protetta perché `isAllowed` è `false`

### Problema 2: Dashboard fallback errato
In `Dashboard.tsx` riga 217: `const ruolo = profile?.ruolo || "admin"` — se il profilo è `null`, mostra la dashboard admin a chiunque (anche utenti non autenticati).

### Problema 3: RoleGuard logga senza utente
`RoleGuard` chiama `logAttivita` anche quando l'utente non è autenticato. `logAttivita` fa `if (!user) return;` quindi il log non viene scritto, ma il redirect avviene comunque senza distinzione tra "non autenticato" e "non autorizzato".

### Problema 4: Nessuna protezione per utenti non autenticati
Tutte le rotte in `MainLayout` sono accessibili senza login. Manca un controllo che verifichi se l'utente ha una sessione attiva.

---

## Piano di Implementazione

### 1. Creare pagina di Login (`src/pages/LoginPage.tsx`)
- Form con email + password usando `supabase.auth.signInWithPassword()`
- Link "Password dimenticata" con `supabase.auth.resetPasswordForEmail()`
- Gestione errori con toast
- Redirect a `/` dopo login riuscito

### 2. Creare pagina Reset Password (`src/pages/ResetPasswordPage.tsx`)
- Controlla `type=recovery` nell'URL hash
- Form per nuova password con `supabase.auth.updateUser({ password })`
- Rotta pubblica `/reset-password`

### 3. Proteggere le rotte autenticate (`src/components/AuthGuard.tsx`)
- Nuovo componente wrapper che controlla `user` da `useAuth()`
- Se `user === null` e `loading === false` → redirect a `/login`
- Wrappare `MainLayout` con `AuthGuard`

### 4. Correggere AuthContext
- Aggiungere gestione dell'evento `SIGNED_OUT` esplicita
- Assicurarsi che `loading` venga settato a `false` solo dopo che il profilo è stato caricato (non prima)

### 5. Correggere Dashboard.tsx
- Cambiare `const ruolo = profile?.ruolo || "admin"` in `const ruolo = profile?.ruolo || ""` e mostrare uno stato vuoto/loading se il profilo non è disponibile

### 6. Correggere RoleGuard.tsx
- Distinguere tra utente non autenticato (redirect a `/login`) e utente autenticato ma non autorizzato (redirect a `/` + log)
- Loggare solo quando l'utente è autenticato ma il ruolo non è permesso

### 7. Aggiornare App.tsx routing
- Rotta `/login` pubblica (fuori da `MainLayout`)
- Rotta `/reset-password` pubblica
- Wrappare `MainLayout` con `AuthGuard`

### Riepilogo file coinvolti
- **Nuovi**: `LoginPage.tsx`, `ResetPasswordPage.tsx`, `AuthGuard.tsx`
- **Modificati**: `App.tsx`, `AuthContext.tsx`, `Dashboard.tsx`, `RoleGuard.tsx`

