

## Piano: Link diretto "Anteprima Portale Cliente" dall'admin

### Cosa cambia

Aggiungere un pulsante **"Anteprima Portale"** nel dialog di gestione Area Riservata (e/o come icona accanto al badge) che apre il portale cliente (`/cliente`) in una nuova scheda del browser.

### Problema attuale
Il `ClienteGuard` blocca l'accesso al portale se `profile.ruolo !== "cliente"`, quindi un admin non può vedere le pagine `/cliente/*`. Serve una modifica al guard per permettere l'accesso anche agli admin.

### Modifiche

**1. `src/components/ClienteGuard.tsx`** — Permettere accesso admin
- Se `profile.ruolo` è `admin` o `ufficio`, bypassare il check e renderizzare i children direttamente (l'admin vede il portale come anteprima)

**2. `src/pages/ClienteDetail.tsx`** — Aggiungere pulsante "Anteprima Portale"
- Nel componente `AreaRiservataHeaderButton`, quando l'area è attiva, aggiungere un'icona/link `ExternalLink` accanto al badge che apre `/cliente` in `target="_blank"`
- Nel dialog, aggiungere un pulsante "Anteprima Portale" nel footer (solo se area attiva)

### Nota tecnica
L'admin vedrà il portale ma i dati mostrati saranno quelli dell'admin stesso (non del cliente specifico), perché il portale usa `auth.uid()` per caricare i dati. Per una vera anteprima contestualizzata servirebbe un meccanismo di impersonation — per ora il link serve come verifica che le pagine funzionino e siano raggiungibili.

### File coinvolti
- `src/components/ClienteGuard.tsx`
- `src/pages/ClienteDetail.tsx`

