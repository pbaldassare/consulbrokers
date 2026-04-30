## Obiettivo

Permettere di **creare nuove utenze Specialist (ed eventualmente Produttori) direttamente dalla pagina Anagrafiche Amministrative**, senza dover passare dal Centro Utenti & Privilegi. Il Centro Utenti rimane disponibile, ma non sarà più l'unico punto d'ingresso.

L'edit della scheda anagrafica completa (RUI, sede, IBAN, percentuali) resta nell'Anagrafiche; in più, dalla stessa scheda, l'admin potrà:
- creare l'utenza di sistema (Auth) per uno Specialist nuovo
- resettare la password di uno Specialist esistente
- attivare/disattivare l'accesso

## Modifiche UI

### `src/components/anagrafiche/SpecialistList.tsx`
1. **Pulsante "+ Nuovo Specialist"** in alto a destra accanto alla search.
2. Apre un dialog **"Nuovo Specialist"** che raccoglie:
   - Cognome, Nome, Email (obbligatori)
   - Sede (obbligatoria, dropdown da `uffici`)
   - Telefono, Codice Fiscale (opzionali)
   - Password iniziale (default `Leone123!`, modificabile)
   - Switch "Attivo" (default on)
3. Al submit chiama l'edge function esistente **`create-user`** con:
   - `ruolo: "backoffice"`
   - `permessi_json`: permessi default del livello L4 Specialist (riusare `LEVELS` da `src/lib/userLevels.ts`)
   - `ufficio_id`, `nome`, `cognome`, `email`, `password`
4. Dopo creazione: invalidate query `specialist-profiles`, toast con email + password, e (opzionale) apre subito il dialog di edit completo per inserire RUI/IBAN/percentuali.
5. Nel dialog di **edit** già esistente aggiungere una sezione "Accesso al sistema" con:
   - Email (read-only, legata all'Auth)
   - Pulsante **"Reset password"** → chiama edge function `provision-user` o nuova action su `create-user` per impostare nuova password
   - Switch "Attivo" già presente (rimane invariato)
   - Badge informativo "Utente Auth: id `xxx`"

### `src/pages/AnagraficheInternePage.tsx` — tab Produttori
Aggiungere lo stesso flusso "+ Nuovo Produttore" (ruolo `corrispondente_1` di default, modificabile a `corrispondente_2/3` nel form) con sede obbligatoria.

### Banner informativo
Aggiornare il banner blu in cima alle liste:
> "Qui gestisci anagrafica completa **e creazione utenze**. Centro Utenti & Privilegi resta disponibile per gestione massiva ruoli e permessi."

## Backend

Nessuna nuova edge function: si riutilizza `supabase/functions/create-user` (già usata dal `CreateUserWizard`).

Per il reset password, verificare se esiste già un endpoint admin; se no, aggiungere a `create-user/index.ts` una action `?action=reset-password` che chiama `supabase.auth.admin.updateUserById(id, { password })` con verifica che il caller sia admin.

Nessuna modifica al DB (il trigger `validate_profilo_sede_required` introdotto nel passo precedente continua a garantire che la Sede sia presente).

## File toccati

- `src/components/anagrafiche/SpecialistList.tsx` — pulsante + dialog "Nuovo Specialist", sezione "Accesso" nell'edit, reset password
- `src/pages/AnagraficheInternePage.tsx` — stesso pattern per il tab Produttori
- `supabase/functions/create-user/index.ts` — aggiunta action `reset-password` (solo se non già presente)
- `public/version.json` — bump

## Note tecniche

- Riusare `LEVELS[3]` (L4 Specialist) per i permessi default Specialist e `LEVELS[2]` (L3) per Produttori — già definiti in `src/lib/userLevels.ts`.
- Il trigger DB rifiuterà l'INSERT se manca `ufficio_id`, quindi la validazione client è solo UX.
- Mantenere il pulsante "Centro Utenti" nel banner per chi vuole il wizard completo multi-step.
- Toast finale deve mostrare chiaramente email + password generata, con pulsante copia.
