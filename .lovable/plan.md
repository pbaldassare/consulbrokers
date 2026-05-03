## Problema

Lo script Google Maps si carica correttamente ma `ensurePlacesLibrary` lancia `"Google Places Autocomplete non disponibile"`. Causa: con `loading=async&v=weekly`, dopo `importLibrary("places")` il costruttore `Autocomplete` viene restituito **dal valore di ritorno della Promise**, non sempre è subito assegnato a `window.google.maps.places.Autocomplete` nel timing in cui lo controlliamo (alcune build asincrone risolvono prima la Promise dell'assegnamento globale, oppure i tipi sono spostati nel nuovo namespace Places).

Il fallback "manuale" parte e quindi CAP/Città/Provincia non vengono compilati.

## Soluzione

Modificare `src/components/AddressAutocomplete.tsx`:

1. **Memorizzare il costruttore restituito da `importLibrary("places")`** invece di affidarsi a `window.google.maps.places.Autocomplete`. La nuova API ufficiale di Google è:
   ```ts
   const { Autocomplete } = await google.maps.importLibrary("places");
   ```
   Questo è il pattern raccomandato con `loading=async`.

2. Salvare il costruttore in una variabile module-level (`AutocompleteCtor`) e usarla in `initAutocomplete` invece di leggerla dal global.

3. Rimuovere il controllo bloccante `hasPlacesAutocomplete()` post-import: se `importLibrary` risolve con un oggetto che contiene `Autocomplete`, è valido.

4. Rimuovere il parametro `&libraries=places` dall'URL (con `loading=async` Google raccomanda di non pre-caricarle e usare solo `importLibrary`), evitando warning.

5. Bump `public/version.json`.

## File da modificare

- `src/components/AddressAutocomplete.tsx` — refactor caricamento Places API
- `public/version.json` — bump versione

## Snippet chiave

```ts
let AutocompleteCtor: typeof google.maps.places.Autocomplete | null = null;

async function ensurePlacesLibrary() {
  if (AutocompleteCtor) return;
  const places = await window.google!.maps!.importLibrary!("places") as
    { Autocomplete: typeof google.maps.places.Autocomplete };
  AutocompleteCtor = places.Autocomplete;
  if (!AutocompleteCtor) throw new Error("Places library senza Autocomplete");
}

// in initAutocomplete:
const ac = new AutocompleteCtor!(inputRef.current, { ... });
```

Confermi?