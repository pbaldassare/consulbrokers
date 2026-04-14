

## Piano: Nascondere "Cambia Stato" per polizze storico

### Logica
Una polizza è "storica" se:
- `stato` è `scaduto` o `sospeso`, oppure
- `stato` è `attivo` ma `garanzia_a < oggi`

Per queste polizze, il blocco "Cambia Stato" (righe 181-189 di `TitoloDetail.tsx`) non deve essere visibile.

### Azione
In `src/pages/TitoloDetail.tsx`, wrappare la Card "Cambia Stato" con una condizione:

```typescript
const isStorico = t.stato === "scaduto" || t.stato === "sospeso" || 
  (t.stato === "attivo" && t.garanzia_a && new Date(t.garanzia_a) < new Date());
```

Se `isStorico` è true, la card viene nascosta. Nessun altro file coinvolto.

