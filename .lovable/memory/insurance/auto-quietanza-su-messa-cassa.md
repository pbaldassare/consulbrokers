---
name: Pre-generazione quietanze su creazione polizza madre
description: Trigger DB genera intera catena quietanze all'insert polizza madre in base a frazionamento+anni_durata; messa a cassa è evento separato
type: feature
---

# Generazione quietanze

## Nuovo comportamento (dal 18/06/2026)

Trigger `trg_genera_quietanze_su_insert_madre` (AFTER INSERT su `titoli`,
funzione `public.genera_quietanze_su_insert_madre`):

- Scatta SOLO su madre (`sostituisce_polizza IS NULL`) e SOLO se `numero_titolo`,
  `garanzia_da`, `garanzia_a` valorizzati e `is_regolazione=false`.
- Calcola `n_rate = (12 / mesi_rata) * anni_durata` da `frazionamento` + `anni_durata`.
  - Mensile=1, Trimestrale=3, Quadrimestrale=4, Semestrale=6, Annuale=12 mesi.
  - **Poliennale** o frazionamento sconosciuto → nessuna pre-generazione.
- Inserisce le rate 2..N concatenate via `sostituisce_polizza`/`sostituisce_riga`,
  stato `attivo`, date traslate (garanzia/durata/competenza/scadenza), importi
  clonati dalla madre (preferendo `*_quietanza` dove presenti).
- Skip se esiste già una quietanza per quella polizza (idempotente; salva da
  reinserimenti legacy).

Esempi:
- Annuale 1y → solo madre.
- Annuale 3y → madre + 2 quietanze annuali.
- Semestrale 1y → madre + 1.
- Trimestrale 1y → madre + 3.
- Mensile 1y → madre + 11.
- Poliennale → solo madre.

## Fallback legacy

Il vecchio trigger `genera_quietanza_su_messa_cassa` resta attivo come fallback:
ha già la skip rule "se la successiva esiste, esci", quindi sulle polizze nuove
non genera nulla. Per le polizze esistenti pre-deploy continua a generare la
quietanza alla messa a cassa.

## UI

`ImmissionePolizzaPage` mostra sotto la sezione "Periodo" un pannello sky con
l'anteprima delle quietanze (idx, garanzia da/a, data competenza), calcolato
client-side da `src/lib/quietanzePlan.ts` (`computeQuietanzePlan`).

## Helper & test

- `src/lib/quietanzePlan.ts`: `computeQuietanzePlan` / `computeQuietanzeOnly`
  (puri, condivisi UI + test).
- `src/lib/__tests__/quietanzePlan.test.ts`: 10 casi coprono tutti i
  frazionamenti, multi-anno, poliennale, edge.

## Cosa NON è cambiato

- Messa a cassa: stesso flusso (incassa rata corrente, passa a `incassato`).
- `quietanza-isolation`: ogni rata resta record indipendente, modificabile.
- `annulla_polizza_cascade`: continua a cancellare tutta la catena via
  `sostituisce_polizza`.
- Importi: editabili per singola rata dopo la creazione.

## Backfill

Nessun backfill automatico: solo le polizze create dopo il deploy hanno la
catena pre-generata.
