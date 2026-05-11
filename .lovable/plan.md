## Problema
In `TitoloDetail.tsx` (form modifica Dati Veicolo RCA Auto), il campo **Uso** è un `<Input>` libero. Deve essere una `SearchableSelect` popolata **esclusivamente** dalla tabella `rca_usi` (stesso comportamento già usato in `ImmissionePolizzaPage.tsx`).

## Modifiche

**File:** `src/pages/TitoloDetail.tsx`

1. Import hook esistente:
   ```ts
   import { useRcaUsi } from "@/hooks/useRcaLookups";
   ```

2. Nel componente, leggere le opzioni:
   ```ts
   const { data: rcaUsi = [] } = useRcaUsi();
   ```

3. Riga 2972 — sostituire l'`Input` con `SearchableSelect`:
   ```tsx
   <div>
     <Label className="text-xs">Uso</Label>
     <SearchableSelect
       options={rcaUsi}
       value={veicoloForm.uso}
       onValueChange={(v) => setVeicoloForm({ ...veicoloForm, uso: v })}
       placeholder="Seleziona..."
     />
   </div>
   ```

## Note
- Nessuna modifica al DB: `rca_usi` è già la fonte unica (43 record, lista piatta) — vedi memoria `rca-auto-specific-data`.
- Nessun cambio a `ImmissionePolizzaPage.tsx` (già corretto).
- Il valore salvato resta `descrizione` (testo), coerente con quanto già fatto altrove.