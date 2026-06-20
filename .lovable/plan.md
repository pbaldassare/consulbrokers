## Causa
Google Maps è caricato con `loading=async`: in questa modalità `google.maps.Map`, `Marker` e `Geocoder` **non sono disponibili come costruttori globali** finché non si chiama `importLibrary()`. Il mio fix precedente provava `importLibrary` ma usava ancora i riferimenti globali `g.maps.Map` / `g.maps.Marker`, che restano stub e tirano "is not a constructor".

## Fix in `src/components/cliente/SinistriMap.tsx`

1. Rimuovere il check iniziale "se `google.maps.Map` esiste salta" — non è affidabile.
2. Cambiare `ensureMapsReady()` per **restituire** le classi importate:
   ```ts
   async function ensureMapsLibs(): Promise<{ Map: any; Marker: any; Geocoder: any; InfoWindow: any; LatLngBounds: any; SymbolPath: any }>
   ```
   - garantisce che il tag `<script>` sia in pagina (riusa esistente);
   - aspetta `window.google.maps.importLibrary`;
   - esegue `const [{ Map, InfoWindow }, { Marker }, { Geocoder }, core] = await Promise.all([importLibrary('maps'), importLibrary('marker'), importLibrary('geocoding'), importLibrary('core')])`;
   - estrae `LatLngBounds` e `SymbolPath` da `core` / `maps`.
3. Nell'`useEffect`: chiamare `const libs = await ensureMapsLibs()` e usare `new libs.Map(...)`, `new libs.Marker(...)`, `new libs.Geocoder()`, `new libs.InfoWindow()`, `new libs.LatLngBounds()`, `libs.SymbolPath.CIRCLE`.
4. Aggiungere un fallback se `importLibrary` non è una funzione (vecchia API): usare `window.google.maps.Map` direttamente.
5. Loggare in console l'errore reale per facilitare il debug futuro.

Nessun cambio fuori da `SinistriMap.tsx`. Niente DB, niente nuovi pacchetti.