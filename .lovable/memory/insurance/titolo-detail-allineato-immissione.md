---
name: TitoloDetail allineato a ImmissionePolizzaPage
description: Pagina dettaglio polizza usa lo stesso wrapper sezione (PolizzaSection) della pagina di immissione, niente più "voce libera", e blocca le modifiche dirette quando la polizza è messa a cassa / stornata.
type: feature
---

## Look & feel

`SectionCollapsible` interno in `src/pages/TitoloDetail.tsx` è ora un thin wrapper sopra `PolizzaSection` (`@/components/polizze/PolizzaSection`). Tutte le sezioni (Contratto, Periodo, Regolazione, Importi, Provvigioni, Veicolo, Premi per Garanzia) hanno lo stesso bordo teal, header e collapsible della pagina di immissione, mantenendo l'API legacy `{title, icon, children, defaultOpen}`.

## Voce libera rimossa

`VociRcaCard` non espone più il pulsante **"Voce libera"** (era usato solo per rami non-auto). Le voci si aggiungono unicamente dal catalogo sottorami (`Aggiungi voce` → popover `rca_garanzie` filtrate per `gruppo_ramo`), in continuità con `PremiGaranziaCardShell` di immissione (memoria `sottoramo-as-garanzia-row`).

## Lock messa-a-cassa

Derivato in TitoloDetail:

```ts
const isLocked = !!t.data_messa_cassa || t.stato === "incassato" || t.stato === "stornato";
```

Quando true:

- Banner ambra in cima alla pagina che spiega lo stato.
- Tutti i pulsanti **Modifica** delle sezioni (Contratto, Periodo, Regolazione, Provvigioni Commerciale, Importi, Veicolo) sono `disabled` con tooltip *"Polizza messa a cassa: modifiche bloccate"*.

Restano disponibili le operazioni dedicate (Annulla Messa a Cassa, Annulla Incasso, Rinnovo, Storno, Sospensione/Riattivazione) che gestiscono le transizioni di stato.

## File

- `src/pages/TitoloDetail.tsx` — wrapper sezione, isLocked, banner, guard sui pulsanti Modifica.
- `src/components/polizze/VociRcaCard.tsx` — rimosso pulsante "Voce libera" (linee ~1088).
