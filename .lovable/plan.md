## Obiettivo
Eliminare il problema delle pagine non aggiornate dopo modifiche/deploy: niente bundle vecchi, niente Service Worker residuo che serve asset obsoleti, niente cooldown che blocca il refresh quando la versione è cambiata.

## Problema individuato
- `main.tsx` registra ancora `/sw.js` al load: anche se è un kill-switch, continua a introdurre navigazioni/registrazioni SW e può lasciare preview/pagine in uno stato incoerente.
- `versionCheck.ts` ha un cooldown di 5 minuti: se il bundle resta vecchio dopo un reload, il guard smette temporaneamente di forzare l’aggiornamento e l’utente resta su pagine vecchie.
- La pulizia cache non forza il bypass completo della cache HTTP/Vite sul documento HTML.
- `AppErrorBoundary` fa `window.location.reload()` semplice, quindi può ricaricare ancora asset vecchi.

## Piano di fix
1. **Service Worker: disattivazione netta**
   - Rimuovere la registrazione di `/sw.js` da `src/main.tsx`.
   - Eseguire a ogni avvio una pulizia best-effort di eventuali SW/cache residui, senza usare flag “una volta sola”.
   - Mantenere `public/sw.js` e `public/service-worker.js` come kill-switch solo per browser che li hanno già registrati.

2. **Version guard più aggressivo e corretto**
   - Modificare `src/lib/versionCheck.ts` per:
     - confrontare sempre `BUNDLE_VERSION` con `/version.json?ts=...` usando `cache: "no-store"`;
     - eliminare il cooldown di 5 minuti che oggi può lasciare l’app vecchia;
     - usare solo un throttle breve anti-loop;
     - forzare reload con URL cache-busted e `window.location.assign/replace`.
   - Se dopo un reload la versione è ancora diversa, continuare a riprovare invece di dichiarare “ok”.

3. **Error boundary con reload pulito**
   - Aggiornare `src/components/AppErrorBoundary.tsx`: il pulsante “Ricarica” deve usare `purgeClientCaches()` + `forceReload(...)`, non `window.location.reload()` semplice.

4. **Version bump**
   - Aggiornare `public/version.json` così la preview vede subito una versione nuova e scatta il refresh.

5. **Controllo finale**
   - Verificare che non restino registrazioni SW nel codice, salvo i kill-switch pubblici.
   - Verificare che le vecchie voci legacy non siano presenti nel codice della sidebar corrente.

## Risultato atteso
Aprendo o ricaricando pagine come `/archivi/clienti/...`, il browser si riallinea sempre all’ultima versione dell’app senza mostrare sidebar/pagine vecchie o bundle obsoleti.