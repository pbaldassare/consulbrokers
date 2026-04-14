

## Piano: Rimuovere filtro compagnie e rinominare filtro stato

### Modifiche su `src/pages/PortafoglioCaricoPage.tsx`

1. **Rimuovere il filtro "Tutte le compagnie"** — eliminare il Select delle compagnie (righe 342-352) e la query lookup compagnie (righe 40-46), lo stato `filtroCompagnia` e il suo uso nella query
2. **Rinominare le opzioni del filtro stato incasso**:
   - "Tutti" → "Tutte" (o simile, opzione per vedere entrambi)
   - "Da incassare" → "Da mettere a cassa"
   - "Incassati" → "Messe a cassa"

### File coinvolto
- `src/pages/PortafoglioCaricoPage.tsx`

