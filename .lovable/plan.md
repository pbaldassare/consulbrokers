Ho verificato la sessione: Google Maps ora mostra i suggerimenti, ma quando selezioni “Via Mergellina, 2, Napoli, NA, Italia” non parte una chiamata di dettaglio luogo visibile e i campi restano quelli vecchi. Il problema non è più la chiave API: è la logica di selezione/dettaglio, che con l’Autocomplete legacy può restituire un risultato incompleto o non scatenare abbastanza robustamente l’aggiornamento dei campi.

Piano di intervento:

1. Rendere l’autocomplete indipendente dal vecchio `getPlace()` incompleto
   - Integrare `AutocompleteService.getPlacePredictions` e `PlacesService.getDetails` in modo controllato.
   - Quando l’utente digita e seleziona un indirizzo, usare sempre il `place_id` della prediction selezionata per chiamare `getDetails`.
   - Richiedere esplicitamente `address_components`, `formatted_address`, `place_id`, `name`, `geometry`.

2. Aggiungere una lista suggerimenti gestita dall’app
   - Sostituire/affiancare il menu `.pac-container` di Google con un dropdown React interno.
   - Questo evita il bug per cui il click sul suggerimento Google cambia il testo ma non aggiorna CAP/Città/Provincia.
   - Ogni click sul suggerimento chiamerà direttamente la funzione che popola i campi.

3. Rafforzare parsing indirizzi italiani
   - CAP da `postal_code`.
   - Città da `locality`, poi `postal_town`, poi `administrative_area_level_3`, poi fallback dal testo della prediction.
   - Provincia da `administrative_area_level_2.short_name`, normalizzata a due lettere uppercase.
   - Gestione di testi come “Napoli, NA, Italia” anche se Google non restituisce tutti i componenti.

4. Correggere il caso “civico prima della via”
   - Nella sessione Google mostra anche risultati con testo tipo `2, Via Mergellina`.
   - Normalizzerò l’indirizzo salvato in formato italiano: `Via Mergellina, 2`.

5. Aggiornare `SediManager`
   - Mantenere update funzionali su `formData`.
   - Sovrascrivere CAP/Città/Provincia quando arriva una selezione Google valida, invece di lasciare i vecchi valori “Milano / MI”.
   - Non cancellare manualmente i campi se Google non fornisce un dettaglio valido.

6. Aggiungere feedback utile in UI
   - Se dopo la selezione Google non torna CAP/Città/Provincia, mostrare un messaggio chiaro e non silenzioso.
   - Se invece il dettaglio arriva, aggiornare immediatamente i tre campi.

File da modificare:
- `src/components/AddressAutocomplete.tsx`
- `src/components/anagrafiche/SediManager.tsx`
- `public/version.json` per forzare refresh cache

Risultato atteso:
- Se digiti “viale mergellina 2” e selezioni “Via Mergellina, 2, Napoli, NA, Italia”, i campi devono diventare indicativamente:
  - Indirizzo: `Via Mergellina, 2`
  - Città: `Napoli`
  - Provincia: `NA`
  - CAP: popolato se Google lo restituisce per quel civico; in caso contrario resta invariato o vuoto con messaggio chiaro.

Nota: per alcuni indirizzi Google può non restituire il CAP specifico se il luogo/prediction è a livello strada e non civico preciso. In quel caso posso aggiungere anche un fallback ulteriore tramite Geocoding API sulla `formatted_address`, ma prima sistemo la selezione perché oggi non sta aggiornando nemmeno Città e Provincia.