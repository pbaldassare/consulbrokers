
## Richiesta

Nel dettaglio della polizza `332437574` (RCA Auto, ramo PC R.C.T./R.C.O), nella card "Messa a Cassa" mancano i pulsanti/sezioni per **Sospensione**, **Riattivazione**, **Storno**, **Duplicazione**, **Rinnovo**, **Appendici** che invece compaiono in altre polizze.

## Investigazione

Devo verificare:
1. `src/pages/TitoloDetail.tsx` — la logica condizionale che mostra/nasconde le operazioni di ciclo vita.
2. La memory `mem://insurance/policy-lifecycle-operations` indica che la logica è differenziata in base al tipo polizza/ramo.
3. Capire perché per questa polizza specifica i pulsanti non appaiono: dipende da `stato`, `data_messa_cassa`, ramo, o altra condizione.
