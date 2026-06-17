---
name: v_portafoglio_titoli — cliente_id vs cliente_anagrafica_id
description: Sulla view v_portafoglio_titoli esistono DUE colonne cliente distinte. Le select popolate da public.clienti DEVONO filtrare su cliente_id; cliente_anagrafica_id punta ad anagrafiche_professionali ed è una FK diversa.
type: feature
---

## Regola

La view `v_portafoglio_titoli` espone:

- `cliente_id uuid` → FK a `public.clienti.id`
- `cliente_anagrafica_id uuid` → FK a `public.anagrafiche_professionali.id`

Sono **due ID diversi**: usare quello sbagliato come filtro restituisce praticamente sempre 0 righe.

## Come applicare

- Quando il filtro UI è popolato da `public.clienti` (es. SearchableSelect "Cliente" in `GestionePolizzePage`), filtrare la view con `.eq('cliente_id', clienteId)`.
- `cliente_anagrafica_id` va usato solo quando l'ID proviene da `anagrafiche_professionali` (es. lookup di produttori/intestatari).

## Storia

Bug riscontrato in `src/pages/GestionePolizzePage.tsx`: il filtro Cliente non filtrava la tabella e l'utente non riusciva a selezionare cliente+polizza prima di lanciare un'operazione (Appendice, Precontrattuale, ecc.). Fix: cambiare `cliente_anagrafica_id` → `cliente_id` nella query di `v_portafoglio_titoli`.
