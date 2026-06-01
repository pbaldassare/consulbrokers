# Ordinamento per Gruppo Ramo nella tabella Rami

## Cosa cambia
Nel tab **Rami** di `Tabelle di Base` (componente `RamiTab` in `src/pages/TabelleBasePage.tsx`) le intestazioni colonna diventano cliccabili per ordinare ascendente/discendente. Focus richiesto: **Gruppo Ramo**, ma per coerenza abilito anche **Codice**, **Descrizione** e **% Tasse Ramo** (stesso pattern, costo zero).

## Comportamento
- Click sull'header: 1° click ASC, 2° click DESC, 3° click reset (torna ordine naturale = `codice` come oggi).
- Indicatore visivo: piccola freccia `↑` / `↓` accanto al titolo cliccato (lucide `ArrowUp`/`ArrowDown`/`ArrowUpDown`).
- Ordinamento client-side sull'array già caricato (locale, niente refetch). La lista è già limitata al tab corrente.
- Per la colonna Gruppo Ramo l'ordinamento usa `r.gruppi_ramo?.codice` (`ZQ`, `ZD`, …) come chiave primaria, fallback `descrizione`. I record senza gruppo finiscono in fondo.
- Confronto stringhe con `localeCompare(it, { numeric: true, sensitivity: 'base' })` per gestire codici come `ZQ-CF` vs `ZQ-ON` correttamente.

## File toccati
- `src/pages/TabelleBasePage.tsx` → solo `RamiTab`: aggiungo state `sortKey`/`sortDir`, helper `toggleSort(key)`, comparatore, sostituisco gli `<TableHead>` con header cliccabili (Button-ghost dentro l'header), applico `.sort` dopo il `filter`.

## Out of scope
- Persistenza ordinamento (reset al refresh).
- Server-side sort (non serve, dataset piccolo).
- Sort sugli altri tab (Gruppi Ramo, Usi RCA, ecc.): si potrà replicare lo stesso pattern se richiesto.
