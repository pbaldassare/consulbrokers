# Fix INSERT titolo: stato "creato" non valido

## Problema

Errore al "Conferma":
> new row for relation "titoli" violates check constraint "titoli_stato_check"

Il check su `titoli.stato` ammette solo: `attivo`, `sospeso`, `scaduto`, `incassato`, `annullato`, `in_attesa_rinnovo`.

In `src/pages/ImmissionePolizzaPage.tsx` riga **789** il payload INSERT usa `stato: "creato"`, valore non valido. Il primo movimento (riga 837) usa già `"attivo"`, coerente con la convenzione.

Memory `policy-states` conferma: gli stati ammessi sono attivo/sospeso/scaduto/incassato (più i due aggiunti).

## Fix

File: `src/pages/ImmissionePolizzaPage.tsx`

Sostituire la riga 789:
```diff
- stato: "creato",
+ stato: "attivo",
```

Il commento già presente alla riga 788 chiarisce che incasso/copertura sono settati dopo via "Messa a Cassa", quindi `attivo` (= polizza emessa, non ancora incassata) è il valore corretto in immissione.

## Out of scope

- Nessuna modifica DB / schema / constraint.
- Nessuna altra logica del salvataggio.
