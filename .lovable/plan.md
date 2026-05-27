Obiettivo: prima di creare uno Specialist (o altro utente gestionale), controllare se l'email esiste già e mostrare un alert chiaro all'utente, senza generare email tecniche.

Cosa cambia:

1. UI — `src/components/anagrafiche/SpecialistList.tsx`
   - Prima della chiamata a `create-user`, eseguire una query a `profiles` filtrando per `email` (case-insensitive).
   - Se trovata: mostrare un `AlertDialog` (o `confirm` modale shadcn) con messaggio chiaro:
     "L'email <x> è già registrata per l'utente <Nome Cognome — ruolo>. Usa un'email diversa."
   - Bloccare la creazione. Nessuna chiamata alla edge function.
   - Se non trovata: procedere come oggi.

2. Edge Function — `supabase/functions/create-user/index.ts`
   - Mantenere il check già presente: se Supabase Auth risponde "already registered" → restituire 409 con messaggio leggibile.
   - La UI gestisce il 409 mostrando lo stesso alert (fallback nel caso l'email esista solo in Auth e non in `profiles`).

3. Verifica
   - Provare a creare uno Specialist con email già esistente → appare alert, nessun utente creato.
   - Provare con email nuova → creazione ok come prima.

Nessuna modifica a DB, RLS o ruoli.