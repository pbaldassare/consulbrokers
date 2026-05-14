Rimuovere il selettore "Nome A-Z / Data creazione" dalla pagina `/archivi/clienti`.

## Modifiche
- **`src/pages/ClientiList.tsx`**:
  - Rimuovere lo stato `sortBy` e il `<Select>` con le opzioni "Nome A-Z" / "Data creazione ↓".
  - Rimuovere l'`useEffect` che resetta la pagina al cambio di `sortBy` e la dipendenza `sortBy` da `useServerPagination` e dalla `queryKey`.
  - Mantenere come ordinamento fisso quello attuale per denominazione (cognome asc, ragione_sociale asc).
  - Rimuovere import non più usati (`Select*`).

Nessuna altra pagina o logica viene toccata.