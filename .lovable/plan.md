## Rimuovi campo "Cambio" dal dettaglio titolo

Il campo Cambio (tasso di conversione valuta) non serve nella visualizzazione.

### Modifica
File: `src/pages/TitoloDetail.tsx` riga 2200 — rimuovere:
```tsx
<FieldRow label="Cambio" value={fmt(t.cambio)} />
```

### Note
- Rimuovo solo la visualizzazione nella card riepilogo.
- Lascio intatto il form di modifica importi (righe 2328-2331) e la validazione (riga 728-729) perché tecnicamente il campo `cambio` resta in DB ed è obbligatorio quando valuta ≠ EUR.
