

## Piano: Rimuovere la pagina Provvigioni standalone

La pagina `/provvigioni` e solo un placeholder e non serve piu — le provvigioni sono gestite direttamente nell'anagrafica commerciale di ogni utente. Le provvigioni nel CFO e nei Pagamenti Provvigioni restano invariate.

### Modifiche

| File | Modifica |
|------|----------|
| `src/components/AppSidebar.tsx` | Rimuovere la voce `{ label: "Provvigioni", path: "/provvigioni" }` dal menu |
| `src/App.tsx` | Rimuovere la Route `/provvigioni` (riga 229) |
| `src/components/PageBreadcrumb.tsx` | Rimuovere entry `"provvigioni"` dalla mappa breadcrumb |

Nessun file da eliminare — la pagina usa gia `PlaceholderPage` inline.

