---
name: Polizza = prima rata incassabile
description: La riga inserita è la polizza e si mette a cassa; si generano solo le quietanze successive. Non esiste più una rata 1/1 clone della madre.
type: feature
---

# Regola (dal 28/09/2026)

**La polizza È la prima rata.** Si mette a cassa sulla scheda polizza.
Ha `data_messa_cassa` / `data_incasso` come qualsiasi titolo incassabile.
Stati titolo: `attivo | incassato | sospeso | scaduto | annullato`.

**Quietanze = solo rate successive (2..N).** Non si crea più una quietanza 1/1
con lo stesso periodo della polizza. Rata unica / Unica / temporanea → solo
la polizza, nessuna figlia.

## Trigger

`trg_genera_quietanze_su_insert_madre` (`genera_quietanze_su_insert_madre`):

- Scatta solo su polizza (`sostituisce_polizza IS NULL`, non AM/PR/RG).
- Rata unica, Unica, temporanea → esce senza inserire figlie.
- Frazionato: genera solo le rate **successive** (periodo traslato), concatenate
  con `sostituisce_polizza` / `sostituisce_riga`.
- Idempotente: se esiste già una figlia per quel numero, esce.

Esempi:
- Annuale / rata unica 1y → **solo polizza**.
- Semestrale 1y → polizza (1° semestre) + **1** quietanza (2°).
- Trimestrale 1y → polizza + **3** quietanze.
- Poliennale → solo polizza, oppure rate successive se frazionata.

## Cambio numero

Cambio numero su una quietanza: la stacca e la **promuove a polizza**
(`pianoCambioNumero` / trigger stacco). Sulla polizza rinomina la catena.

## Storico

Backfill `promuovi_prima_quietanza_storico`: prima quietanza del modello
vecchio → diventa polizza; guscio madre eliminato se senza FK.

## Annullamento e reincasso

`annulla_polizza_cascade` elimina le quietanze successive e lascia la polizza
`annullato`. Per reincassare **non si rigenerano rate**: si riporta la polizza
ad `attivo` e si mette a cassa **quella riga** (`ripristinaPolizzaPerIncasso`).

## UI

- `TitoloDetail`: Messa a Cassa sulla polizza (e sulle quietanze successive).
- Niente box «l'incasso si fa sulla singola quietanza».
- `canHaveDataCopertura` è sempre true.
- `displayStatoPolizza` non maschera più `incassato` sulla madre.

## Cosa NON fare

- Non reintrodurre «madre = solo contratto / non si mette a cassa».
- Non generare una quietanza clone 1/1 della polizza.
- Non dire che per reincassare servono rate nuove.
