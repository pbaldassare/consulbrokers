## Obiettivo
Sistemare l'utenza demo "Comune di Varese" (collegata al prospect ID `68178b0a-...`) per permettere il login al portale prospect.

## Stato attuale
- **profiles** `746c540d-7e65-417d-9834-39612c13213a`: ruolo `cliente` ❌ (dovrebbe essere `prospect`), email `protocollo@comune.it`
- **auth.users**: email `protocollo@comune.it`, già confermata, ultimo accesso 5 mag 2026
- **prospect** `68178b0a-...`: collegato via `user_id`, stato `chiuso_vinto`

## Azioni

### 1. Allineamento ruolo profilo (UPDATE dati)
Aggiornare `profiles.ruolo` da `cliente` → `prospect` per l'ID `746c540d-7e65-417d-9834-39612c13213a`. Questo permetterà ad `AuthGuard` di dirottarlo correttamente su `/prospect`.

### 2. Reset password via edge function
Creare una nuova edge function una-tantum `reset-demo-password` (oppure riusare logica esistente in `create-prospect-user`) che:
- Usa `SUPABASE_SERVICE_ROLE_KEY`
- Chiama `supabase.auth.admin.updateUserById('746c540d-...', { password: 'Leone123!' })`
- Restituisce conferma

In alternativa più rapida: invocare direttamente lo script via edge function temporanea o tramite modifica admin nel pannello.

### Credenziali finali per login portale prospect
- **URL**: `/login`
- **Email**: `protocollo@comune.it`
- **Password**: `Leone123!` (standard demo del progetto)

### 3. Verifica
- Login con le credenziali sopra
- Conferma redirect automatico a `/prospect` (dashboard prospect)

## Note
- Nessuna modifica schema DB richiesta
- L'email in `auth.users` (`protocollo@comune.it`) differisce da quella anagrafica del prospect (`protocollo@comune.varese.it`); non la tocco perché è quella effettivamente usata per il login.
- L'`ufficio_id` resta NULL: i prospect non hanno bisogno di Sede assegnata sul profilo per accedere al portale.
