Ho verificato i segnali disponibili: non risultano errori runtime/console/HTTP 500, ma il replay mostra un loop di reload su `/login?__v=...` con il parametro `__v` che cambia continuamente. Il problema principale è quindi nel sistema di version check/cache, non nella pagina specifica.

Piano di intervento:

1. Stabilizzare `versionCheck.ts`
   - Impedire reload multipli ravvicinati con un cooldown persistente che non venga cancellato dal purge cache.
   - Evitare che `purgeClientCaches()` cancelli le chiavi tecniche del version checker.
   - Aggiungere un lock “in flight” per non lanciare più check/reload simultanei da `main`, `AppVersionGuard`, focus e login.
   - Rendere il reload “one-shot”: dopo un tentativo recente, l’app deve proseguire invece di ricaricare all’infinito.

2. Centralizzare il controllo versione
   - Lasciare a `AppVersionGuard` il polling periodico.
   - Rimuovere/neutralizzare il doppio check immediato in `main.tsx`, che oggi può sovrapporsi al guard.
   - Ridurre la probabilità di reload mentre l’utente è nella schermata login o mentre Supabase sta caricando la sessione.

3. Correggere `AppVersionGuard.tsx`
   - Mantenere il controllo automatico, ma senza effetto “mitraglia” su focus/visible/online.
   - Usare un debounce/cooldown interno per evitare più chiamate ravvicinate allo stesso check.

4. Sistemare `LoginPage.tsx`
   - Rimuovere il version check bloccante prima del login: se il check decide di ricaricare proprio durante il submit, crea stati instabili.
   - Il login deve procedere normalmente; l’aggiornamento bundle resta gestito dal guard globale.

5. Aggiungere una protezione anti-schermata bianca
   - Inserire un Error Boundary globale attorno all’app, così eventuali crash React mostrano una schermata recuperabile invece di lasciare l’app apparentemente morta.
   - Loggare l’errore reale in console per diagnosi successive.

6. Forzare il refresh controllato
   - Aggiornare `public/version.json` una sola volta a fine modifica, così il browser prende il nuovo comportamento senza entrare di nuovo nel loop.

Verifica prevista:
- Controllare che `/login` non cambi più `__v` in continuazione.
- Controllare che non ci siano reload ripetuti nel replay/preview.
- Confermare che la sessione Supabase non venga cancellata dal purge cache.