Il problema ora non è più il caricamento di Maps: dai log Google Places si inizializza. Il punto debole è che stiamo usando il vecchio `google.maps.places.Autocomplete`, che per alcuni risultati può restituire un `PlaceResult` incompleto oppure senza `address_components` completi. Inoltre nel componente padre `SediManager` l’handler usa uno snapshot di `formData`, quindi conviene renderlo più sicuro con aggiornamenti funzionali.

Piano di intervento:

1. Rendere `AddressAutocomplete` robusto sulla selezione
   - Modificare il tipo `GooglePlaceResult` per includere anche `place_id`, `formatted_address` e `name`.
   - Nel listener `place_changed`, se `getPlace()` non contiene `address_components` completi, chiamare `PlacesService.getDetails` usando `place_id`.
   - Richiedere esplicitamente nei details: `address_components`, `formatted_address`, `name`, `geometry`.
   - Solo dopo i details, estrarre e inviare al padre indirizzo, CAP, città e provincia.

2. Migliorare l’estrazione dati italiani
   - Mantenere `postal_code` per CAP.
   - Per città usare questa priorità: `locality`, `postal_town`, `administrative_area_level_3`, `sublocality`, `administrative_area_level_2` come fallback.
   - Per provincia usare `administrative_area_level_2.short_name` quando disponibile, ripulendo prefissi tipo `Città Metropolitana di` o `Provincia di` se Google restituisce nomi lunghi.
   - Normalizzare l’indirizzo come `Via/Piazza ..., civico`, ma se mancano route/civico usare `formatted_address` ripulito dalla parte CAP/città/provincia.

3. Aggiungere fallback locale per i casi in cui Google non restituisce CAP
   - Usare la libreria già presente `src/lib/comuniItaliani.ts` come fallback per città/provincia quando Google restituisce solo comune o provincia.
   - Non inventare dati: il CAP verrà compilato solo se Google lo restituisce o se è deducibile in modo univoco dai dati locali disponibili; altrimenti resta manuale.

4. Sistemare `SediManager`
   - Cambiare `onChange` e `onSelect` dell’indirizzo usando `setFormData(prev => ...)` per evitare di sovrascrivere CAP/Città/Provincia con valori vecchi.
   - Quando arriva una selezione valida, aggiornare sempre insieme `indirizzo`, `cap`, `citta`, `provincia`.

5. Aggiornare cache/versione
   - Incrementare `public/version.json` per forzare il refresh della preview.

Risultato atteso:
- Il menu Google continua ad apparire.
- Selezionando un suggerimento, il componente non si ferma al valore testuale digitato ma recupera i dettagli completi del place.
- CAP, Città e Provincia vengono popolati automaticamente quando Google fornisce questi dati.
- Se Google restituisce un risultato parziale, il form resta modificabile manualmente senza blocchi.