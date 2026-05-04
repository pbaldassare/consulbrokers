## Diagnosi: cosa fa "caricare pagine sbagliate"

Analizzati `App.tsx`, `AuthGuard`, `LoginPage`, `Dashboard`, `RoleGuard`, `ClienteGuard`, `ProspectGuard`, `AppSidebar` e tutte le `routes/*.tsx`. Il login Supabase ora funziona (token 200, profilo admin caricato), ma il routing dopo l'accesso ha 4 bug reali:

### 1. Rotta `/prospect` registrata DUE VOLTE con guard diversi
- `src/routes/archivi.tsx` riga 17: `<Route path="/prospect" element={<ProspectList />} />` dentro `AuthGuard` (gestionale interno)
- `src/routes/prospect.tsx` riga 11: `<Route path="/prospect" element={<ProspectDashboard />} />` dentro `ProspectGuard` (portale prospect)
- Anche la sidebar admin ha "Prospect → /prospect" (AppSidebar riga 102)

Risultato: cliccando "Prospect" da admin, React Router può matchare la rotta del portale prospect → `ProspectGuard` rifiuta admin → redirect a `/` → loop / pagina bianca. Bug confermato dal fatto che `ProspectGuard` ammette **solo** `ruolo === "prospect"`.

### 2. `ProspectGuard` blocca admin e ufficio
A differenza di `ClienteGuard` (che fa eccezione per admin/ufficio per anteprima portale), `ProspectGuard` butta fuori chiunque non sia prospect. Inconsistente e causa di redirect indesiderati.

### 3. `ClienteGuard` mostra schermata bianca durante il check
Riga 24: `if (loading || checking) return null;` → flash di pagina vuota invece di spinner. Inoltre `checking` parte sempre `true` anche per admin che non ha bisogno della query su `clienti`.

### 4. Doppio redirect su `/` per utenti senza permesso dashboard
`AuthGuard` (righe 44-49) E `Dashboard` (righe 308-317) implementano entrambi la stessa logica "se non hai dashboard vai altrove". Si rincorrono: AuthGuard redirige, poi Dashboard si monta solo per un istante e re-redirige. Per ruoli con `permessi_json = null` (come admin) `getDefaultRoute` ritorna `/` e va bene; per altri profili può lampeggiare la pagina sbagliata prima di stabilizzarsi.

### 5. `LoginPage` redirect prima che il profile sia caricato
Righe 21-24: appena `user` è valorizzato (ma `profile` ancora `null` per un tick), `getDefaultRoute(null)` ritorna `"/login"` → fallback a `/`. Poi quando il profile arriva un `cliente`/`prospect` viene rimbalzato altrove. Visivamente sembra che "carichi la pagina sbagliata".

---

## Cosa farò (5 file, modifiche chirurgiche)

### A. `src/routes/archivi.tsx`
- **Rimuovere** la rotta `/prospect` (lista prospect interna) e spostarla su `/archivi/prospect`
- Lasciare `/prospect/:id` su `/archivi/prospect/:id`
- Aggiungere alias `<Route path="/prospect-list" ...>` per non rompere link interni se servono

### B. `src/components/AppSidebar.tsx`
- Cambiare il link sidebar admin da `/prospect` a `/archivi/prospect` (riga 102)
- Aggiungere `hideForRoles: ["prospect","cliente"]` al gruppo Trattative per sicurezza

### C. `src/components/ProspectGuard.tsx`
- Aggiungere spinner invece di `return null` (coerente con `AuthGuard`)
- Permettere preview admin/ufficio come fa `ClienteGuard`

### D. `src/components/ClienteGuard.tsx`
- Sostituire `return null` con spinner durante `loading || checking`
- Saltare la query su `clienti` per admin/ufficio (subito `setChecking(false)`)

### E. `src/components/AuthGuard.tsx` + `src/pages/Dashboard.tsx`
- Mantenere la sola logica di redirect "no dashboard" in `AuthGuard` (già presente)
- **Rimuovere** il `useEffect` duplicato in `Dashboard.tsx` (righe 307-317) per eliminare il doppio redirect

### F. `src/pages/LoginPage.tsx`
- Aspettare che `profile` sia caricato prima del redirect: condizione `!authLoading && user && profile` (oppure `!authLoading && user && profileResolved`)
- Se `user` esiste ma profile ancora null e auth non è in loading, mostrare spinner per max 1-2 secondi prima di mandare a `/`

---

## File esatti che toccherò

```text
src/routes/archivi.tsx          (sposta /prospect → /archivi/prospect)
src/components/AppSidebar.tsx   (aggiorna link sidebar)
src/components/ProspectGuard.tsx (spinner + admin preview)
src/components/ClienteGuard.tsx (spinner + skip query per admin)
src/pages/Dashboard.tsx         (rimuovi useEffect redirect duplicato)
src/pages/LoginPage.tsx         (aspetta profile prima del Navigate)
```

Nessuna migration DB, nessun cambio a `AuthContext`, nessuna modifica a `getDefaultRoute`.

Confermi e procedo?