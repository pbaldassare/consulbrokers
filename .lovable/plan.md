## Bug

Nella card mobile/tablet (<1024px) di VociRcaCard, il nome della garanzia (es. "ARD Incendio autovetture") non si vede: appaiono solo i campi prezzo. Causa: il `<div className="flex ... min-w-0">` che contiene icona + label, dentro un `flex justify-between`, collassa a larghezza 0. Lo `<span className="truncate">` quindi non ha spazio.

## Fix

`src/components/polizze/VociRcaCard.tsx` linea 711:

- `<div className="flex items-center gap-1.5 font-medium text-sm min-w-0">` → aggiungere `flex-1`
- `<span className="truncate">` → aggiungere `flex-1` per occupare lo spazio rimanente

Risultato: il contenitore label prende tutto lo spazio disponibile prima del bottone Lock/Trash a destra, e il nome garanzia diventa visibile (con troncamento se troppo lungo).
