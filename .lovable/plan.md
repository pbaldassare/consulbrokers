## Diagnosi

Il modal non mostra anteprima perché oggi visualizza la tabella solo quando `risultati.length > 0`. Se la funzione risponde errore o warning, l’utente vede solo `Salva 0` senza dettagli. Dai log inoltre risultano chiamate con `sizeKB: 0` e il gateway risponde `The document has no pages`, quindi va intercettato il caso file/base64 vuoto o PDF non leggibile prima di inviare o subito dopo la risposta.

## Piano di intervento

1. **Rendere il caricamento verificabile lato frontend**
   - Bloccare file vuoti o letture base64 vuote con messaggio chiaro.
   - Resettare il valore dell’input file dopo ogni scelta, così ricaricare lo stesso allegato rilancia davvero l’analisi.
   - Mostrare stato esplicito nel modal: file selezionato, analisi in corso, errore/warning, righe estratte.

2. **Aggiungere una vera area anteprima nel modal**
   - Mostrare sempre un pannello sotto il pulsante, anche con 0 righe.
   - Stati previsti:
     - nessun file caricato;
     - analisi in corso;
     - errore leggibile;
     - warning AI;
     - tabella preview con righe estratte e correggibili.
   - `Salva` resta disabilitato solo se non ci sono righe valide, ma l’utente capisce perché.

3. **Correggere risposta edge function per PDF non validi/non leggibili**
   - Validare `pdf_base64` minimo prima di chiamare Lovable AI.
   - Se il gateway risponde `The document has no pages`, restituire warning utente invece di errore generico 502.
   - Mantenere log tecnici, ma trasformare gli errori comuni in messaggi operativi.

4. **Verifica e deploy**
   - Deploy della funzione `parse-tariffario-rami` dopo la modifica.
   - Test diretto della funzione con payload vuoto/minimo per confermare il warning pulito.
   - Verifica che nel modal compaia sempre l’anteprima/stato e non rimanga più silenzioso su `Salva 0`.