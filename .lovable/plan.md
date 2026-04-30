## Obiettivo

Aggiungere una nuova opzione al menu a tendina "In qualità di" nella sezione INTERMEDIARIO ISCRITTO AL RUI:

> Addetto all'intermediazione al di fuori dei locali del broker (dipendente/collaboratore)

## Modifica

In `src/pages/DocPrecontrattualePage.tsx`, nel `<select>` di "In qualità di" (riga ~641), aggiungere una quarta `<option>` dopo "Società di capitali":

```tsx
<option value="Addetto all'intermediazione al di fuori dei locali del broker (dipendente/collaboratore)">
  Addetto all'intermediazione al di fuori dei locali del broker (dipendente/collaboratore)
</option>
```

Il valore viene già usato come stringa nel PDF (campo `qualitaDi`), quindi nessuna modifica al generatore PDF.

## Nota sul mobile

Il `<select>` nativo è già responsive (apre il picker nativo su mobile/iOS/Android), quindi funziona correttamente anche da telefono.

## File modificati
- `src/pages/DocPrecontrattualePage.tsx`
- `public/version.json` (bump)
