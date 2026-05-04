Il problema è nella visualizzazione del menu laterale: l’utente vede ancora voci vecchie come FatturaPA anche se il codice attuale non le contiene più. Procedo con una correzione mirata per forzare l’allineamento della UI alla versione corrente ed eliminare residui di cache/browser/PWA.

Piano di intervento:

1. Ripristinare un `AppVersionGuard` reale
   - Ora `AppVersionGuard` è un no-op, quindi non forza più l’aggiornamento dell’app quando cambia la versione.
   - Reintrodurrò un controllo leggero su `/version.json` con cache-busting.
   - Se rileva una versione diversa da quella salvata nel browser, pulisce cache/service worker residui e ricarica una sola volta.

2. Rendere la dismissione cache/service worker più robusta
   - La pulizia attuale in `main.tsx` è “best effort” ma non forza un reload coordinato.
   - Sposterò/centralizzerò la logica in una utility riutilizzabile, con:
     - unregister di tutti i service worker,
     - cancellazione Cache Storage,
     - gestione errori silenziosa,
     - reload controllato solo quando serve.

3. Aggiornare `public/version.json`
   - Incrementerò la versione pubblica per attivare subito il refresh sui client che hanno ancora il bundle vecchio.
   - Userò una nuova stringa timestamp/versione.

4. Verificare che le vecchie voci non siano più raggiungibili dal menu
   - `AppSidebar.tsx` oggi non contiene `FatturaPA`, quindi non serve rimuoverla dal sorgente.
   - Controllerò solo che non ci siano duplicati/vecchie definizioni menu in altri punti.
   - Le route legacy `/fatturapa` resteranno come redirect a `/contabilita`, così eventuali link vecchi non portano a pagine obsolete.

Risultato atteso:
- Aprendo l’app, chi ha ancora una versione vecchia riceverà automaticamente la versione nuova.
- La sidebar mostrerà solo le voci definite nel codice attuale.
- Voci vecchie come FatturaPA non resteranno visibili per colpa della cache.