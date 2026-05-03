## Piano per risolvere la pagina non aggiornata

Il problema visibile nello screenshot è che l’app sta ancora mostrando una versione vecchia: nel codice attuale `Anagrafica` è già prima di `Polizze`, ma nella preview risulta ancora non aggiornata o non riallineata al bundle più recente.

### 1. Rendere l’ordine tab inequivocabile
In `src/pages/ClienteDetail.tsx` controllerò e consoliderò l’ordine delle tab del dettaglio cliente:

```text
Anagrafica → Polizze → Sinistri → Aziende/Persone → Documenti → Chat → Timeline → Trattative
```

Se serve, aggiungerò anche una gestione controllata della tab attiva per evitare che stati/cache precedenti mantengano selezioni vecchie.

### 2. Forzare refresh corretto della preview/app
Interverrò sul meccanismo di versione/cache per far sì che la preview carichi il bundle aggiornato:

- aggiornare `public/version.json` con una nuova versione;
- rafforzare il controllo in `src/lib/versionCheck.ts` anche per preview/dev Lovable, senza creare loop infiniti;
- aggiungere un evento su focus/visibilità pagina che verifica la versione anche quando l’utente torna sulla tab;
- se viene rilevata una versione vecchia, forzare un reload con parametro cache-busting.

### 3. Pulizia cache/service worker residui
Il progetto ha già una pulizia dei service worker in `src/main.tsx`. La renderò più robusta così, se il browser sta servendo file vecchi, l’app prova a svuotare le cache residue prima di renderizzare.

### 4. Confermare la parte Maps/manuale
Mantengo il comportamento già aggiunto: se Google Maps non parte, il campo resta compilabile manualmente e l’utente vede il messaggio di errore. Non cambio la logica di parsing CAP/Città/Provincia già implementata.

### File da modificare
- `src/pages/ClienteDetail.tsx`
- `src/lib/versionCheck.ts`
- `src/main.tsx`
- `public/version.json`

### Risultato atteso
Dopo il salvataggio, ricaricando la preview dovresti vedere subito la pagina aggiornata con `Anagrafica` prima di `Polizze`, e le prossime modifiche dovrebbero comparire senza rimanere bloccate su versioni vecchie.