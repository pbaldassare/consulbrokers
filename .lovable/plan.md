## Piano

1. **Correggere il controllo versione dell’app**
   - Evitare che `main.tsx` cancelli cache e storage a ogni avvio: oggi questo rallenta/rompe il normale ciclo di reload e può lasciare la preview in stati strani.
   - Fare il purge solo quando `/version.json` indica davvero che il bundle aperto è vecchio.

2. **Auto-reload più rapido quando Lovable pubblica una nuova preview**
   - Portare il controllo periodico di `AppVersionGuard` da 5 minuti a un intervallo breve, così dopo una modifica il browser si aggiorna da solo senza Ctrl+F5.
   - Aggiungere controllo immediato quando la finestra torna attiva o riceve focus.

3. **Ricarica pulita e sicura**
   - Mantenere il `__v=<timestamp>` nella URL per bypassare cache vecchie.
   - Conservare la sessione Supabase, quindi l’utente non viene disconnesso.
   - Evitare loop di reload con il throttle già presente.

4. **Aggiornare la versione statica**
   - Bump di `public/version.json` per forzare la preview a prendere subito il nuovo comportamento.

## Dettagli tecnici

- File da modificare:
  - `src/main.tsx`
  - `src/components/AppVersionGuard.tsx`
  - `public/version.json`
- Nessuna modifica a database, Supabase, ruoli o business logic.
- Obiettivo: quando faccio una modifica al codice, la preview rileva automaticamente la nuova versione e si ricarica da sola.