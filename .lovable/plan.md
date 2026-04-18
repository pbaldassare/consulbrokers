
## Analisi richiesta

L'utente vuole arricchire il profilo di ogni utente con dati personali editabili **da due punti**:
1. **Admin/gestione**: dalla scheda utente in `/utenti-privilegi` (tab Anagrafica visibile in screenshot)
2. **Self-service**: dalla dashboard personale dell'utente

### Campi da aggiungere
- `nome` (già esiste in `profiles`)
- `cognome` (già esiste in `profiles`)
- `telefono` (nuovo)
- `avatar_url` (nuovo) → immagine profilo
- `note` (nuovo) → testo libero sintetico

Tutti **non obbligatori**.

## Verifico schema attuale

Esploro `profiles` per vedere quali campi esistono già e quali vanno aggiunti.

## Piano di implementazione

### 1. Database (migration)
Aggiungere a `profiles` (se mancanti):
- `telefono TEXT NULL`
- `avatar_url TEXT NULL`
- `note TEXT NULL`

Creare bucket Storage **`avatars`** (pubblico in lettura) con policy:
- SELECT pubblica (chiunque può vedere gli avatar)
- INSERT/UPDATE/DELETE: solo l'utente proprietario sul proprio path `{user_id}/...`

RLS su `profiles` per self-update: policy che permette a un utente di aggiornare **solo i propri** campi `nome, cognome, telefono, avatar_url, note` (no `ruolo`, `permessi_json`, `attivo`, `ufficio_id`).

### 2. Componenti riutilizzabili
**`src/components/utenti/ProfileAvatarUpload.tsx`** — upload avatar con:
- Preview circolare (Avatar component esistente)
- Pulsante "Carica foto" → file picker (jpg/png, max 2MB)
- Upload su `avatars/{user_id}/avatar.{ext}`
- Pulsante "Rimuovi"
- Aggiorna `profiles.avatar_url`

**`src/components/utenti/ProfileInfoForm.tsx`** — form condiviso:
- Input: Nome, Cognome, Telefono
- Textarea: Note (max 500 char, contatore)
- Mode `admin` (può editare qualsiasi userId) o `self` (solo proprio)
- Salva → `UPDATE profiles` + `logAttivita`

### 3. Integrazione gestione utenti
**`src/components/utenti/UserPermissionsSheet.tsx`** (tab Anagrafica):
- Sostituire/estendere il form esistente con `ProfileAvatarUpload` + `ProfileInfoForm` in mode `admin`
- Mantenere Email/Ruolo/Sede/Account attivo già presenti
- Salva tutto con un solo click "Salva modifiche"

### 4. Dashboard personale utente
**Nuova pagina `src/pages/MioProfilo.tsx`** accessibile da:
- Click su avatar/nome utente in `Topbar` → menu dropdown → "Il Mio Profilo"
- Route `/mio-profilo` (per tutti gli utenti autenticati, no role guard)

Layout:
- Card "Foto profilo" con `ProfileAvatarUpload`
- Card "Dati personali" con `ProfileInfoForm` in mode `self`
- Card "Account" (read-only): email, ruolo, sede

### 5. Avatar visibili nell'app
Dove c'è già un avatar/iniziali utente (Topbar, lista utenti, chat, commenti), leggere `avatar_url` da `profiles` e mostrarlo se presente, fallback alle iniziali attuali.

### 6. Tipi & Context
- Estendere `UserProfile` interface in `AuthContext.tsx` con `telefono`, `avatar_url`, `note`
- Aggiornare `fetchProfile` per selezionare i nuovi campi

## File toccati

**Nuovi:**
- `supabase/migrations/<timestamp>_add_profile_fields_and_avatars.sql`
- `src/components/utenti/ProfileAvatarUpload.tsx`
- `src/components/utenti/ProfileInfoForm.tsx`
- `src/pages/MioProfilo.tsx`

**Modificati:**
- `src/contexts/AuthContext.tsx` (estendere UserProfile + select)
- `src/components/utenti/UserPermissionsSheet.tsx` (tab Anagrafica)
- `src/components/Topbar.tsx` (menu utente + link "Il Mio Profilo" + avatar)
- `src/App.tsx` (route `/mio-profilo`)

## Cosa NON cambia
- Ruoli, permessi, sede, attivo restano gestibili **solo dall'admin** in `/utenti-privilegi`
- L'utente self-service vede ma non modifica email/ruolo/sede
- Nessun campo diventa obbligatorio: tutti opzionali

## Sicurezza
- Bucket `avatars` pubblico in lettura (necessario per `<img src>`)
- Upload limitato a 2MB lato client + validazione MIME
- RLS impedisce a un utente di toccare campi sensibili di altri profili
