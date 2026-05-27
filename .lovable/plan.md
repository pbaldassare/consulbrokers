## Problema

Nel dettaglio cliente la CTA "Nuova Polizza" è disponibile solo dentro il tab Polizze (header card + empty state). Quando il tab attivo è un altro o la lista è lunga, non è immediato lanciare l'immissione polizza con cliente già pre-selezionato.

## Fix

**`src/pages/ClienteDetail.tsx` — header pagina**
- Aggiungere `<NuovaPolizzaButton clienteId={id} size="sm" />` nell'area azioni dell'header (accanto a `Modifica` / `Attivo`), sempre visibile, indipendente dal tab selezionato.
- Mantenere le due CTA esistenti dentro il tab Polizze (header card + empty state) per non rompere il flusso attuale.

## Note

- `NuovaPolizzaButton` esiste già e gestisce `?clienteId=...` → l'immissione si apre con cliente pre-collegato.
- Nessuna modifica RBAC: l'azione era già accessibile, qui la rendiamo solo più raggiungibile.
- Bump `public/version.json`.

## Verifica

Apertura `/archivi/clienti/{id}`: il bottone "Nuova Polizza" è visibile nell'header sia sul tab Anagrafica sia su Polizze; click → `/portafoglio/immissione?clienteId={id}`.
