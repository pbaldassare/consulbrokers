

## Piano: Provisioning automatico utenti per clienti + completamento portale

### Situazione attuale
- **480 clienti** in DB, tutti con email, **nessuno** con `user_id` collegato
- 4 email duplicate (clienti azienda con email generica tipo `info@...`)
- `clienti.user_id` esiste gia (migration precedente), RLS base presente
- Layout, guard e 9 pagine cliente gia create (ma alcune basiche)
- Le RLS documenti per il cliente usano `entita_id = auth.uid()` (errato, dovrebbe usare `get_my_cliente_ids()`)
- Nessun meccanismo automatico per creare utenti auth quando si inserisce un cliente

### Piano di implementazione

#### Step 1 — Edge Function `provision-clienti-users`
Creare una nuova Edge Function che:
1. Legge tutti i clienti con `user_id IS NULL` e `email IS NOT NULL`
2. Per email duplicate: aggiunge un suffisso numerico (es. `info+2@meccanica...`)
3. Per ogni cliente:
   - Crea utente in `auth.users` con email + password `Leone123!`
   - Crea record in `profiles` con ruolo `cliente`
   - Crea record in `user_roles` con role `cliente`
   - Aggiorna `clienti.user_id` con l'id appena creato
4. Gestisce errori per singolo record senza bloccare gli altri
5. Restituisce report con conteggi (creati/errori/skippati)

Questa function va invocata una tantum per i clienti esistenti.

#### Step 2 — Edge Function `create-cliente-user` (trigger per nuovi clienti)
Creare una Edge Function invocabile dal frontend quando si crea/modifica un cliente dal gestionale:
- Prende `cliente_id` come parametro
- Legge email del cliente, crea utente auth + profile + user_roles + aggiorna `clienti.user_id`
- Se email gia in uso in auth, salta la creazione e logga

Modificare `ClienteDetail.tsx` / form di creazione cliente per invocare questa function dopo il salvataggio.

#### Step 3 — Migration: rendere email NOT NULL e fix RLS documenti
- `ALTER TABLE clienti ALTER COLUMN email SET NOT NULL`
- Aggiornare la policy RLS `Cliente select own documenti` per usare `get_my_cliente_ids()` invece di `auth.uid()` direttamente (gia parzialmente fatto ma la vecchia policy usa `cliente_id = auth.uid()`)

#### Step 4 — Bottone "Provisioning Clienti" nella pagina Manutenzione
Aggiungere un bottone nella pagina `ManutenzionePage.tsx` che invoca `provision-clienti-users` con feedback di progresso.

### File coinvolti

| Azione | File |
|--------|------|
| Creare | `supabase/functions/provision-clienti-users/index.ts` |
| Creare | `supabase/functions/create-cliente-user/index.ts` |
| Creare | Migration SQL (email NOT NULL + fix RLS) |
| Modificare | `src/pages/ManutenzionePage.tsx` — bottone provisioning |
| Modificare | `src/pages/ClienteDetail.tsx` — invocare create-cliente-user al salvataggio |

### Dettagli tecnici

**Gestione email duplicate**: per clienti con stessa email (es. `info@azienda.it`), il sistema usa `email+N@dominio.it` come alias (Gmail-style) per creare utenti auth distinti, mantenendo l'email originale nel campo `clienti.email`.

**Password default**: `Leone123!` per tutti. Il cliente potra fare reset password dal login.

**Batch processing**: la provision processa un cliente alla volta (non parallelizzabile per limiti Supabase auth admin API) con max 500 record per invocazione.

