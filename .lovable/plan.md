
Do I know what the issue is? Sì.

## Piano: eliminare i fallback vecchi e forzare sempre la build aggiornata dopo il login

### Problema individuato
Non sembra un problema di hosting Lovable: l’app usa `BrowserRouter` e Lovable gestisce già il fallback SPA a `index.html`. Il problema è lato client:

- `src/main.tsx` controlla la versione solo al bootstrap iniziale
- dopo il login `src/pages/LoginPage.tsx` usa `navigate(...)`, quindi spesso continua la stessa SPA già caricata in memoria
- la pulizia di cache/service worker residui è asincrona e non viene attesa
- i redirect sono sparsi (`LoginPage`, `Dashboard`, `RoleGuard`) e alcuni fanno fallback a `/`, creando rimbalzi su pagine precedenti o non coerenti

### Cosa farò
1. **Centralizzare la gestione versione**
   - creare un helper condiviso per:
     - leggere `APP_VERSION`
     - confrontarla con la versione già vista
     - fare un hard reload una sola volta per build
     - aggiungere protezione anti-loop

2. **Forzare refresh reale quando serve**
   - applicare il controllo versione:
     - all’avvio app, prima del mount React
     - al ritorno del tab/pagina (`pageshow`, `visibilitychange`)
     - sul ripristino browser (`back_forward`)
   - se la build è cambiata: usare `window.location.replace(...)` / hard reload, non `navigate(...)`

3. **Forzare build aggiornata subito dopo login**
   - in `src/pages/LoginPage.tsx` sostituire il redirect SPA con redirect duro verso la prima route consentita
   - così, quando fai login, il browser ricarica davvero documento e asset dell’ultima build

4. **Unificare i fallback di routing**
   - estrarre una funzione unica tipo `getDefaultAuthorizedRoute(profile)`
   - usarla in:
     - `LoginPage`
     - `Dashboard`
     - `RoleGuard`
     - `AuthGuard`
   - eliminare il fallback fisso a `/` quando non è la destinazione corretta per quell’utente

5. **Evitare flash di stato vecchio**
   - rendere deterministica la pulizia iniziale di cache/SW prima del render
   - ripulire anche lo stato client che può mostrare dati/pagine vecchie nella stessa sessione

### File coinvolti
- `src/main.tsx`
- `src/pages/LoginPage.tsx`
- `src/pages/Dashboard.tsx`
- `src/components/RoleGuard.tsx`
- `src/components/AuthGuard.tsx`
- nuovo helper condiviso per versione + landing route
- possibile piccolo refactor del `QueryClient` per permettere reset pulito dello stato client

### Risultato atteso
- quando pubblichi una nuova versione, chi fa login vede sempre la build aggiornata
- niente fallback continuo a pagine precedenti
- niente rimbalzi inutili su `/`
- stessa logica di atterraggio in tutta l’app, coerente con i permessi

### Dettagli tecnici
- non serve aggiungere `_redirects`: Lovable non li usa
- non reintrodurrò PWA/service worker
- il fix è su navigazione client, refresh forzato e coerenza dei redirect

### Validazione finale
Verificherò questi casi:
1. nuova build pubblicata con tab vecchio aperto
2. logout/login
3. refresh manuale
4. back del browser
5. ritorno al tab dopo inattività

Tutti devono portare sempre alla versione più aggiornata e alla pagina corretta per l’utente.
