

## Piano: Creare il livello di utenza "Prospect"

### Obiettivo
Creare un nuovo ruolo utente `prospect` con portale dedicato (`/prospect`) dove il prospect può vedere le proprie trattative e caricare/scaricare documenti. L'account viene creato automaticamente quando si inserisce un prospect con email.

### Modifiche

**1. Database — Collegare prospect a user account**
- Aggiungere colonna `user_id` (uuid, nullable, references auth.users) alla tabella `prospect`
- Questo collega il record prospect all'account auth, come `clienti.user_id` per i clienti

**2. Edge Function — `create-prospect-user`**
- Simile a `create-cliente-user`: crea account auth con email del prospect e password di default (`Leone123!`), crea profilo con ruolo `prospect`, aggiorna `prospect.user_id`
- Trigger automatico: chiamata dalla pagina ProspectDetail o al momento della creazione prospect se ha email

**3. Guard — `ProspectGuard.tsx`**
- Come `ClienteGuard.tsx` ma verifica `profile?.ruolo === "prospect"`
- Redirige a `/login` se non autenticato, a `/` se ruolo diverso

**4. Layout — `ProspectLayout.tsx`**
- Simile a `ClienteLayout.tsx` con header "CBnet — Area Prospect"
- Nav items: Dashboard, Trattative, Documenti, Comunicazioni, Upload

**5. Pagine portale prospect** (`src/pages/prospect/`)
- `ProspectDashboard.tsx` — riepilogo con KPI (trattative in corso, documenti, stato)
- `ProspectTrattative.tsx` — lista delle proprie trattative con stato e dettagli
- `ProspectDocumenti.tsx` — documenti relativi alle proprie trattative
- `ProspectUploadDoc.tsx` — upload documenti per la propria pratica

**6. Route — `src/routes/prospect.tsx`**
- Rotte sotto `/prospect/*` protette da `ProspectGuard`

**7. AuthGuard — aggiornare redirect**
- Aggiungere: se `ruolo === "prospect"` e path non inizia con `/prospect`, redirect a `/prospect`
- Come già fatto per il ruolo `cliente`

**8. App.tsx — aggiungere rotte prospect**
- Importare e montare `prospectRoutes`

**9. SitemapPage.tsx — aggiornare**
- Aggiungere ruolo "Prospect" (livello 4, come Cliente, icona `UserPlus`, colore arancione)
- Aggiungere sezione "Portale Prospect" con le 4 pagine
- Aggiungere badge `prospect` dove necessario

**10. LoginPage.tsx — gestire redirect post-login**
- Se ruolo `prospect`, redirect a `/prospect` dopo login

### File coinvolti
| Azione | File |
|--------|------|
| Migrazione | `prospect.user_id` colonna |
| Nuovo | `supabase/functions/create-prospect-user/index.ts` |
| Nuovo | `src/components/ProspectGuard.tsx` |
| Nuovo | `src/components/ProspectLayout.tsx` |
| Nuovo | `src/pages/prospect/ProspectDashboard.tsx` |
| Nuovo | `src/pages/prospect/ProspectTrattative.tsx` |
| Nuovo | `src/pages/prospect/ProspectDocumenti.tsx` |
| Nuovo | `src/pages/prospect/ProspectUploadDoc.tsx` |
| Nuovo | `src/routes/prospect.tsx` |
| Modifica | `src/App.tsx` |
| Modifica | `src/components/AuthGuard.tsx` |
| Modifica | `src/pages/LoginPage.tsx` |
| Modifica | `src/pages/SitemapPage.tsx` |

