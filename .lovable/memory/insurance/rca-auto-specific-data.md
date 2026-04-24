---
name: RCA Auto Specific Data
description: Validazioni e automazioni per polizze RCA Auto - catalogo veicoli locale, usi RCA piatti, tipi veicolo come rami
type: feature
---

La gestione delle polizze RCA Auto integra:

- **Catalogo veicoli locale**: tabelle `veicoli_marche` e `veicoli_modelli` (DB) con flag `popolare` per ordinamento. Inserimento on-the-fly dal form via `MarcaModelloCombobox`.
- **Tipi veicolo come rami**: i 16 ex `rca_settori` sono stati inglobati in `rami` con codici `RV01…RV16` e descrizioni `VEICOLO - …` sotto il gruppo `ZQ - R.C.A.`. La tabella `rca_settori` non esiste più.
- **Usi RCA**: tabella `rca_usi` (43 record) come **lista piatta** senza dipendenza da settore (colonna `settore_id` rimossa). Hook `useRcaUsi()` senza parametri.
- **Form RCA** (`ImmissionePolizzaPage.tsx`): non c'è più dropdown "Settore"; il valore `vSettore` viene popolato dal "Tipo Veicolo" selezionato. Il dropdown "Uso" è sempre abilitato.
- **Permessi**: lettura per tutti gli authenticated; INSERT/UPDATE riservato a staff.
- **Classi BM**: 18 classi di merito (1–18) per RCA Auto.
- **Tipi veicolo hardcoded**: `TIPI_VEICOLO` in `src/lib/rcaConstants.ts` resta come riferimento alternativo nel form.
