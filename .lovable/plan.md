

## Piano: Nuovo ruolo "backoffice" + 3 utenti demo

### Cosa cambia

1. **Aggiungere `backoffice` all'enum `app_role`** nel database — questo ruolo vedrà e gestirà solo polizze/clienti a lui assegnati.

2. **Aggiornare il frontend**:
   - Aggiungere `"backoffice"` all'array `ROLES` in `GestioneUtenti.tsx`
   - Aggiungere `"backoffice"` nei `allowedRoles` delle rotte pertinenti (archivi clienti, titoli, polizze, sinistri, etc.) in `App.tsx`
   - Aggiungere `"backoffice"` nella sidebar (`AppSidebar.tsx`) per rendere visibili le voci di menu appropriate
   - Aggiungere `"backoffice"` in `AuthGuard.tsx` e `NuovaConversazioneDialog.tsx` dove si listano i ruoli interni

3. **Creare 3 utenti backoffice** tramite la Edge Function `seed-demo-users` aggiornata, con dati completi (nomi italiani, indirizzi, etc.) e password `Demo2024!`.

### Modifiche per file

| File | Modifica |
|------|----------|
| **Migration SQL** | `ALTER TYPE app_role ADD VALUE 'backoffice'` |
| **GestioneUtenti.tsx** | Aggiungere `"backoffice"` a `ROLES` |
| **App.tsx** | Aggiungere `"backoffice"` nei `allowedRoles` per rotte clienti, titoli, polizze, sinistri, portafoglio |
| **AppSidebar.tsx** | Includere `"backoffice"` nelle condizioni di visibilità delle voci pertinenti |
| **NuovaConversazioneDialog.tsx** | Aggiungere `"backoffice"` alla lista ruoli nella query utenti chat |
| **seed-demo-users/index.ts** | Aggiungere 3 utenti backoffice con profili completi |

### Dettagli tecnici

- Il backoffice avrà accesso a: Dashboard, Archivi (clienti), Titoli, Polizze, Sinistri, Portafoglio, Chat, Documenti
- Non avrà accesso a: Contabilità, CFO, Impostazioni, Gestione Utenti, Tabelle Base
- I 3 utenti: `backoffice1@consul.it`, `backoffice2@consul.it`, `backoffice3@consul.it`
- In futuro si potrà implementare la visibilità filtrata (solo clienti/polizze assegnati) tramite RLS

