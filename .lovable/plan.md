## Fix: Google Maps autocomplete non parte

### Diagnosi
Nello screenshot l'icona MapPin (visibile solo quando `ready=true`) **non compare**, e nei network logs non c'è alcuna richiesta a `maps.googleapis.com`. Il caricamento dello script fallisce silenziosamente.

Cause più probabili:
1. **Auth failure di Google** (chiave non valida, dominio `*.lovable.app` non tra i referrer autorizzati, o **Places API non abilitata** sul progetto Google Cloud). Google non chiama `script.onerror` in questi casi: invoca `window.gm_authFailure`, che oggi non è gestito.
2. Mancato uso di `loading=async` (Google ora stampa warning + a volte blocca).
3. Errore precedente che ha lasciato `googleScriptPromise` in stato rejected, impedendo retry.

### Modifiche

**`src/components/AddressAutocomplete.tsx`**
- Definire `window.gm_authFailure` globale → setta flag `googleAuthFailed`, logga messaggio chiaro con link a Google Cloud Console, notifica i componenti montati.
- Aggiungere `loading=async&v=weekly` all'URL dello script (raccomandato da Google).
- Validare `GOOGLE_MAPS_API_KEY` prima di iniettare lo script (reject esplicito).
- Aggiungere stato `error` nel componente: se lo script fallisce o c'è auth failure, mostrare un piccolo testo rosso sotto l'input ("Autocomplete non disponibile — verifica chiave/dominio Google Maps") così l'utente capisce e può comunque digitare CAP/Città/Provincia manualmente.
- Reset di `googleScriptPromise` quando il caricamento fallisce, per consentire un retry al prossimo mount.

**`public/version.json`** → bump.

### Cosa deve fare l'utente in parallelo (probabile root cause)
Nel pannello Google Cloud Console del progetto associato alla chiave `AIzaSyA76iVcQpSnl76_G6bJVnEeOUmWVd7278I`:
1. **Abilitare le API**: "Maps JavaScript API" + "Places API".
2. **Restrizioni della chiave** → HTTP referrers: aggiungere
   - `https://*.lovable.app/*`
   - `https://*.lovable.dev/*`
   - `https://consulnet.iaconnect.it/*`
   - `http://localhost:*/*`
3. Salvare e attendere ~1-2 min per la propagazione.

Senza questi permessi nessun fix lato codice farà partire l'autocomplete: il messaggio d'errore aggiunto al componente ti dirà esattamente quando il problema è risolto.

### Note tecniche
- Nessuna modifica DB.
- Nessuna modifica RLS o edge functions.
- Il fix non tocca la logica di parsing migliorata nell'iterazione precedente.