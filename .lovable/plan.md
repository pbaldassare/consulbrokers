## Obiettivo
Sostituire la card "Riserve vs Liquidato" nella pagina `/cliente/sinistri` con una **mappa Google** che mostra i sinistri geolocalizzati, con marker colorati per tipologia e popup con i dettagli.

## Modifiche

### 1. Nuovo componente `src/components/cliente/SinistriMap.tsx`
- Carica Google Maps JS API (riusa `loadGoogleMapsScript` già presente in `AddressAutocomplete.tsx` — estraibile in `src/lib/googleMapsLoader.ts` per condivisione).
- Riceve `sinistri[]` (lista filtrata già disponibile nella pagina).
- Per ogni sinistro: geocoding indirizzo (`indirizzo_sinistro, cap, città, provincia`) → coordinate; cache in `useMemo` + `Map<string, LatLng>` per evitare richieste duplicate.
- Marker `google.maps.Marker` (no AdvancedMarker → niente `mapId`) con colore in base a `tipo_sinistro`:
  - `furto / atti_vandalici_auto` → rosso
  - `rc_patrimoniale / rc_*` → blu
  - `rca_* / cristalli` → arancio
  - `infortunio_*` → viola
  - default → grigio teal
- `InfoWindow` su click con: N. sinistro, tipologia (label leggibile da `tipiSinistro.ts`), garanzia, data evento, luogo, riserva.
- Bounds auto-fit su tutti i marker; fallback centro su Varese (45.8206, 8.8251) zoom 9 quando nessun marker geocodificabile.
- Altezza fissa ~360px per allinearsi alla card grafico a fianco.
- Legenda compatta in basso con i colori delle macro-tipologie.

### 2. `src/pages/cliente/ClienteSinistri.tsx`
- Rimuovere la card "Riserve vs Liquidato" (righe ~297-311) e il `BarChart` relativo + import `Bar` se non più usato.
- Inserire `<SinistriMap sinistri={filteredSinistri} />` dentro una `Card` con header `"Mappa Sinistri"` + breve `InfoHint`.
- La KPI card "Liquidato" in alto resta (è il KPI numerico, non il grafico).

### 3. Helper `src/lib/googleMapsLoader.ts` (estratto)
- Esporta `loadGoogleMapsScript()` e costante `GOOGLE_MAPS_API_KEY` da `VITE_GOOGLE_MAPS_API_KEY` (o `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` se presente, fallback).
- `AddressAutocomplete.tsx` aggiornato per importare da qui (no duplicazione).

## Note tecniche
- Geocoding lato browser tramite `new google.maps.Geocoder()` (già usato in AddressAutocomplete) — nessun edge function necessaria.
- Risultati di geocoding salvati in `sessionStorage` con chiave hash dell'indirizzo per evitare richieste ripetute tra navigazioni.
- Marker nascosti se geocoding fallisce; counter "X di Y sinistri mappati" sotto la mappa.
- Nessun cambio DB.

## File toccati
- `src/components/cliente/SinistriMap.tsx` (nuovo)
- `src/lib/googleMapsLoader.ts` (nuovo, estratto)
- `src/components/AddressAutocomplete.tsx` (refactor import)
- `src/pages/cliente/ClienteSinistri.tsx` (sostituzione card)