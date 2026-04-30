## Obiettivo

Integrare il componente `AddressAutocomplete` (Google Maps Places) nel campo **Indirizzo** del dialog "Nuova/Modifica Sede" in `SediManager.tsx`, coerente con gli altri form (Clienti, Compagnie, Specialist, Prospect).

## Modifiche

**File**: `src/components/anagrafiche/SediManager.tsx`

1. **Import** (riga 15): aggiungere
   ```ts
   import { AddressAutocomplete } from "@/components/AddressAutocomplete";
   ```

2. **Campo Indirizzo nel form** (riga 248): sostituire l'`<Input>` con:
   ```tsx
   <AddressAutocomplete
     value={formData.indirizzo}
     onChange={(v) => setFormData({ ...formData, indirizzo: v })}
     onSelect={(c) => setFormData({
       ...formData,
       indirizzo: [c.indirizzo, c.cap, c.citta, c.provincia].filter(Boolean).join(", "),
     })}
     placeholder="es. Via Roma 1, 20121 Milano"
   />
   ```

3. **Bump** `public/version.json`.

## Note tecniche

- La tabella `uffici` ha solo la colonna `indirizzo` (text), non campi separati cap/città/provincia → al `onSelect` salvo l'indirizzo completo concatenato.
- Stessa chiave `VITE_GOOGLE_MAPS_API_KEY` già usata negli altri form, nessuna nuova secret.
- Nessuna migration, nessun cambio schema.

## File toccati

- `src/components/anagrafiche/SediManager.tsx`
- `public/version.json`
