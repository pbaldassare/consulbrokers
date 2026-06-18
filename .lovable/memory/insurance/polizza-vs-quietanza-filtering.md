---
name: Polizza vs Quietanza filtering
description: Filtro Tipo unificato in Carico/Attive/Storico; nel dettaglio cliente sono invece due tab separati
type: feature
---
- In **Portafoglio Carico / Attive / Storico** distinzione via `sostituisce_polizza`: filtro `Tipo` (Polizze+Quietanze / Solo polizze / Solo quietanze) + colonna badge.
- In **ClienteDetail** (`/archivi/clienti/:id`) NON c'è il filtro Tipo: ci sono due tab separati `Polizze (n)` e `Quietanze (n)`. La tabella interna è la stessa (`PolizzeClienteTable`) ma in modalità diversa via prop `mode`:
  - `mode="polizze"` → solo madri, niente chevron/righe figlie.
  - `mode="quietanze"` → vista flat di tutte le rate, con riferimento alla polizza madre nella colonna N. Polizza.
