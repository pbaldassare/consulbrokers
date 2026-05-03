Ho verificato il problema: nella preview l’errore reale è `google.maps.importLibrary non disponibile`, quindi lo script Google Maps viene caricato in una modalità in cui `importLibrary` non è esposto. Per questo l’autocomplete non parte e l’indirizzo non viene “preso”.

Piano di intervento:

1. Correggere il caricamento Google Maps in `src/components/AddressAutocomplete.tsx`
   - Ripristinare il caricamento compatibile con Autocomplete classico usando `libraries=places` nell’URL dello script.
   - Non dipendere solo da `google.maps.importLibrary`, perché nel browser attuale non è disponibile.
   - Mantenere comunque un fallback: se `importLibrary` esiste lo uso, altrimenti uso `window.google.maps.places.Autocomplete`.

2. Rendere l’inizializzazione più robusta
   - Dopo `script.onload`, attendere esplicitamente che `window.google.maps.places.Autocomplete` sia realmente disponibile prima di inizializzare il campo.
   - Evitare che il componente finisca subito in errore se il global Google è presente ma Places non è ancora agganciato.
   - Gestire correttamente script già presenti in pagina per evitare caricamenti duplicati.

3. Migliorare la selezione indirizzo
   - Verificare che il listener `place_changed` venga collegato all’input.
   - Continuare a estrarre e compilare: indirizzo normalizzato, CAP, città e provincia.
   - Lasciare i campi manuali come fallback solo se Google fallisce davvero per chiave/dominio/API non abilitata.

4. Aggiornare la versione app
   - Incrementare `public/version.json` per forzare il refresh della preview ed evitare che resti servita una versione vecchia.

File da modificare:
- `src/components/AddressAutocomplete.tsx`
- `public/version.json`

Risultato atteso:
- Digitando un indirizzo come “viale mergellina” il menu Google Places deve comparire sotto il campo.
- Selezionando un suggerimento, il componente deve compilare automaticamente CAP, Città e Provincia.
- L’errore rosso “Autocomplete non disponibile” deve comparire solo in caso di reale problema Google: chiave API non valida, dominio non autorizzato, Places API non abilitata o blocco rete.