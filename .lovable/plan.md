
## Ho capito

La card "Quietanze (rate da pagare)" nel form Nuova Polizza **non serve**. Tutto deriva automaticamente da:

- **Durata Da / Durata A** (card Periodo) → finestra totale della polizza
- **Frazionamento** → quante quietanze creare e come spezzare le finestre

### Regola di calcolo (lato trigger DB, niente UI)

- **Annuale** (durata 1/7/2026 → 1/7/2027): 1 quietanza, garanzia 1/7/2026 → 1/7/2027 (coincide con la durata).
- **Semestrale** stessa durata: 2 quietanze
  - Rata 1: 1/7/2026 → 1/1/2027
  - Rata 2: 1/1/2027 → 1/7/2027
- **Trimestrale**: 4 quietanze da 3 mesi · **Quadrimestrale**: 3 da 4 · **Mensile**: 12 da 1 · **Poliennale Nanni**: N quietanze annuali consecutive.

Gli importi (netto/tasse/SSN/addizionali/provvigioni) delle quietanze li calcola il trigger pro-quota dai totali della polizza, come già fa oggi. Eventuali aggiustamenti per-rata si fanno **dopo**, dal dettaglio della singola quietanza, non in creazione.

## Cosa cambia

### `src/pages/ImmissionePolizzaPage.tsx`
1. Rimuovere l'import e il render di `<QuietanzeEditor />` dalla sezione "Quietanze (rate da pagare)" (incluso il `Collapsible`/Card contenitore se introdotto solo per questo).
2. Rimuovere lo stato `quietanzeDrafts` e il blocco post-insert che fa `SELECT polizza_id` + loop di `UPDATE quietanze` con i draft. La generazione resta interamente al trigger `tg_polizza_after_insert_genera_quietanze`.
3. Lasciare invariate Periodo (Durata Da/A, Anni Durata, Frazionamento, Garanzia Da/A, Data Competenza, GG Mora, Tacito Rinnovo, Disdetta, Limite Mora) e la card Importi.

### `src/components/polizze/QuietanzeEditor.tsx`
- File **eliminato** (non più usato altrove).

### `src/lib/quietanzePlan.ts` e i suoi test
- **Restano** come sono: già usati per i test di regressione del calcolo e potenzialmente da altre viste (dettaglio polizza). Non li tocco.

### DB
- **Nessuna migrazione**. Il trigger `fn_polizza_genera_quietanze` (aggiornato il 19/06 per gestire Poliennale come N quietanze annuali) è già coerente con la regola richiesta. Il backfill già eseguito resta valido.

### Memory
- Aggiornare `mem://insurance/quietanze-editor-immissione` per riflettere la rimozione: la card non esiste più, la generazione è 100% server-side dal trigger su `polizze` partendo da durata + frazionamento.

## Out of scope
- Editing per-rata in creazione (rimosso per scelta).
- Modifica delle regole di calcolo finestre/importi del trigger.
- Card Carico / badge Quietanza N/M (già a posto).
