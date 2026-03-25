

## Piano: Rimuovere Template Ruoli e Matrice Provvigioni

Queste due pagine non servono più perché le provvigioni sono gestite direttamente nell'anagrafica di ogni utente commerciale.

### Modifiche

| File | Modifica |
|------|----------|
| `src/components/AppSidebar.tsx` | Rimuovere le voci "Template Ruoli" e "Matrice Provvigioni" dal menu SISTEMA. Rimuovere import `FileStack` e `Grid3X3` se non usati altrove |
| `src/App.tsx` | Rimuovere le Route `/template-ruoli` e `/matrice-provvigioni` e i relativi import di `GestioneTemplateRuoli` e `MatriceProvvigioni` |
| `src/components/PageBreadcrumb.tsx` | Rimuovere le entry `matrice-provvigioni` e `template-ruoli` dalla mappa breadcrumb |
| `src/pages/GestioneTemplateRuoli.tsx` | Eliminare il file |
| `src/pages/MatriceProvvigioni.tsx` | Eliminare il file |

Nessuna modifica al database — le tabelle `matrice_provvigioni` e `template_ruoli` restano nel DB per ora (dati storici), semplicemente non sono più accessibili dalla UI.

