## Problema

In `/titoli/95567873-…` (polizza ramo QA — R.C. AUTO) si osservano due bug:

1. **Voci salvate senza codice**: in DB le righe `premi_garanzia_polizza` hanno `garanzia="QA"`, `codice_garanzia=NULL`, e nessun link al sottoramo selezionato in immissione. Si perde la descrizione (es. "R. C. AUTO") e il codice ufficiale del sottoramo.
2. **Riga "RCA Auto · obbligatoria"** appare in alto nelle card Firma/Quietanza anche se l'utente ha già selezionato i sottorami riga per riga (QA, QI, 045, …). È un refuso del vecchio modello "principale RCA" e va eliminato.

## Cosa fare

### 1. Salvataggio corretto delle voci in `ImmissionePolizzaPage.tsx` (≈ riga 1094)

In `buildPremiInsert` includere i campi del sottoramo:
- `garanzia` ← `r.descrizione || r.codice` (descrizione leggibile, non più il codice come fallback primario)
- `codice_garanzia` ← `r.codice || null`
- `ramo_id` ← `r.sottoramoId || null` (link al sottoramo `rami.id`)

In questo modo, riaprendo la polizza, le card mostrano codice + descrizione del sottoramo selezionato.

### 2. Rimozione della riga "RCA Auto obbligatoria" in `VociRcaCard.tsx`

- Rimuovere lo `useEffect` (righe 218–235) che auto-inserisce la riga `is_rca_principale=true` quando `useAutoTaxFormula=true`.
- Rimuovere il badge "obbligatoria" (riga 700) e l'icona "principale" (riga 682).
- Mantenere la logica formula RCA (IPT + SSN 10,5%) ma applicarla automaticamente alle righe il cui `codice_garanzia` corrisponde al **sottoramo RCA** del gruppo (QA, PI, RV*, QN/QT/QNA/DD/DN/DNA per natanti) anziché al flag `is_rca_principale`. In pratica: una riga è "RCA principale" se il suo `codice_garanzia` ∈ set RCA del gruppo del titolo.
- Per le polizze esistenti con la riga refuso a 0,00: lasciarla in DB (non distruttiva), ma l'UI non la marcherà più come obbligatoria. L'utente potrà cancellarla manualmente dal cestino.

### 3. Aggiornamento memoria

Aggiornare `mem://insurance/rca-voci-composizione-premio.md`: rimuovere "Riga RCA Auto sempre presente, non rimovibile" e descrivere la nuova regola basata su `codice_garanzia`.

## Fuori scopo

- Pulizia retroattiva dei record `premi_garanzia_polizza` già esistenti (incluse le 14 righe duplicate `3454` viste in DB su questa polizza in lato Quietanza): se vuoi le pulisco con una migration separata, fammelo sapere.
- Modifiche al trigger `genera_quietanza_su_messa_cassa` o a `sync_quietanza_da_firma`.
