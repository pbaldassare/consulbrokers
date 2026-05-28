## Problema confermato

La tua preview sta ancora mostrando una versione vecchia della sidebar: nello screenshot compaiono voci rimosse/obsolete come `CONT. GENERALE` e `FATTURAPA`, mentre nel codice attuale non risultano più nella sidebar. Quindi non è solo un problema di singola pagina: è il client/preview che sta servendo o mantenendo codice non aggiornato.

## Piano di intervento

1. **Rendere il cambio versione deterministico**
   - Smettere di basarsi solo sul timestamp generato da Vite.
   - Inserire una versione forzata e stabile leggibile dal client, così ogni salvataggio importante produce un mismatch certo tra bundle vecchio e `/version.json` nuovo.

2. **Mostrare un avviso visibile invece di fare solo reload silenziosi**
   - Aggiungere un banner/modale “Nuova versione disponibile” quando il bundle è vecchio.
   - Pulsante `Aggiorna ora` che esegue pulizia cache/SW e ricarica con URL cache-busted.
   - Se il reload automatico viene bloccato dal browser/iframe Lovable, l’utente ha comunque un controllo evidente.

3. **Rafforzare la pulizia cache senza rompere la sessione**
   - Continuare a preservare chiavi Supabase/sessione.
   - Rimuovere cache residue, Service Worker e dati locali non essenziali.
   - Evitare loop infiniti con throttle breve.

4. **Neutralizzare definitivamente i Service Worker legacy**
   - Verificare che non esistano più registrazioni nuove.
   - Lasciare `sw.js` e `service-worker.js` solo come kill-switch, ma renderli ancora più aggressivi nel forzare la navigazione cache-busted sui client già controllati.

5. **Pulire la confusione del menu vecchio**
   - Confermare che `Cont. Generale` e `FatturaPA` non siano più presenti nel codice attuale.
   - Se necessario, aggiungere un marker di versione visibile nei log/UI per capire subito se la preview sta mostrando il bundle corretto.

6. **Verifica finale**
   - Aprire la preview e controllare console/network: bundle version, `/version.json`, assenza di SW registrati.
   - Confermare che la sidebar visualizzata corrisponda al codice attuale e non mostri più le voci obsolete.

## Nota tecnica

Il problema più probabile non è React Router: è una combinazione di preview iframe + vecchio bundle ancora caricato + cache/SW pregressi. Il fix deve quindi dare sia reload automatico sia un fallback manuale visibile quando il browser non sostituisce davvero il documento.