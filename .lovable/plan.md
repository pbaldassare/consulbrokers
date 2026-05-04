Ho verificato il progetto e il problema non è più nella voce di menu attuale: nel codice sorgente la sidebar nuova non contiene più `FATTURAPA` o `CONT. GENERALE`. Se però nel preview compaiono ancora, significa che il browser sta eseguendo un bundle vecchio o una preview salvata/cachata.

Piano di correzione definitivo:

1. Ripristinare un `AppVersionGuard` reale
   - Attivare un controllo versione all’avvio dell’app.
   - Confrontare la versione del bundle caricato con `/version.json` richiesto sempre con cache-busting.
   - Se non coincidono, pulire cache/browser storage tecnico e ricaricare una sola volta con parametro anti-cache.
   - Mostrare un messaggio di aggiornamento invece di lasciare l’utente su pagine vecchie.

2. Forzare controllo versione prima/durante login
   - In `LoginPage`, prima del redirect post-login, verificare che la versione caricata sia quella servita dal server.
   - Se il bundle è vecchio, non far entrare l’utente nella dashboard vecchia: pulire cache e ricaricare.
   - Questo risolve il caso “alla login devo avere la stessa versione sempre”.

3. Rendere la pulizia cache più forte
   - Estendere la pulizia attuale in `main.tsx` per eliminare service worker, Cache Storage e vecchi storage tecnici senza cancellare la sessione Supabase in modo distruttivo se non necessario.
   - Eseguire la pulizia in modo controllato per evitare reload infiniti.

4. Eliminare ogni residuo navigabile delle voci obsolete
   - Mantenere i redirect `/fatturapa` e `/cont-generale` verso `/contabilita`.
   - Aggiungere una protezione lato codice per bloccare eventuali vecchi link salvati o menu renderizzati da bundle obsoleti.
   - Nessuna voce `FATTURAPA`/`CONT. GENERALE` resterà raggiungibile come area autonoma.

5. Aggiungere identificazione versione visibile nei log
   - Stampare in console la versione bundle e quella server, così si può capire subito se il browser sta usando una build vecchia.
   - Utile per verificare definitivamente il problema in preview/pubblicato.

6. Verifica finale
   - Aprire preview alla root e a `/login`.
   - Controllare che la sidebar caricata non mostri `FATTURAPA`/`CONT. GENERALE`.
   - Controllare che una vecchia route tipo `/fatturapa` venga rediretta a `/contabilita`.
   - Controllare console/network per confermare che `/version.json` venga richiesto con cache-busting.

File previsti:
- `src/components/AppVersionGuard.tsx`
- `src/pages/LoginPage.tsx`
- `src/main.tsx`
- eventuale piccolo helper in `src/lib/` per centralizzare confronto versione/cache
- eventualmente `public/version.json` o `vite.config.ts` solo se serve rendere la versione più robusta

Non sono previste modifiche al database.