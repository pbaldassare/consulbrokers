---
name: Provvigioni Compagnie/Ramo page
description: Pagina dedicata `/provvigioni-compagnie-ramo` per gestire le % provvigione per agenzia + ramo, separata dalla form compagnie
type: feature
---

## Pagina
File: `src/pages/ProvvigioniCompagnieRamoPage.tsx`
Route: `/provvigioni-compagnie-ramo`
Sidebar: gruppo "Provvigioni" → voce "Provvigioni Compagnie/Ramo".

## Dati
Tabella `provvigioni_compagnia_ramo` (compagnia_id, categoria_id, percentuale_provvigione, attiva).
Soft delete: `attiva=false` invece di DELETE per preservare storico.

## UI
- Lista globale con tutte le regole attive (join compagnie + categorie_prodotto).
- Filtri: ricerca testo · agenzia (SearchableSelect) · tipo (agenzia/broker/direzione/plurimandataria) · ramo (categoria).
- Badge tipo colorato coerente con `CompagnieList`: emerald/blue/purple/orange.
- Inline edit della % (Enter conferma, Esc annulla).
- Dialog "Nuova Provvigione" con select agenzia + ramo + %.
- Tabella zebra (idx % 2).

## Rationale
La tab Provvigioni è stata rimossa dal dialog di creazione agenzia in `CompagnieList.tsx`. Tutta la gestione delle % per ramo passa ora da questa pagina dedicata, evitando affollamento della form anagrafica.
