
## Hai ragione: la card Regolazione è disallineata

Nello screenshot la card mostra ancora i **campi legacy** (Regolazione Sì checkbox, Periodicità, Tipo Scadenza, GG Presentazione, Tipo Lettera, Libro Matricola). Ma per memoria progetto (`regolazione-reminder-flag` + `titolo-detail-allineato-immissione`) la card deve essere **promemoria**, identica a quella di `TitoloDetail`:

- **Switch** "Polizza in regolazione (promemoria)" (al posto della checkbox + label "Regolazione Sì").
- Quando ON appare un **blocco ambra** con 3 soli campi:
  - **Data presunta** (`regolazione_data_presunta`, date)
  - **Fattore** (`regolazione_fattore`, SearchableSelect: `fatturato | num_dipendenti | retribuzioni | altro`)
  - **Note** (`regolazione_note`, textarea)
- Quando OFF: campi nascosti e azzerati al submit.

I campi legacy (`periodicita`, `tipo_scadenza`, `giorni_presentazione`, `tipo_lettera_regolazione`, `libro_matricola`) **restano in DB** (convivono) ma **escono dalla UI** della card Regolazione in creazione, come già fatto in TitoloDetail.

## Modifiche

### `src/pages/ImmissionePolizzaPage.tsx`

1. **Stato (riga ~358-368)**: rimuovere `tipoLetteraRegolazione`, `tipoScadenza`, `giorniPresentazione`, `periodicita`, `libroMatricola`; aggiungere `regolazioneDataPresunta`, `regolazioneFattore`, `regolazioneNote`. Mantenere `regolazione` boolean.
2. **AI prefill map (~520-528)**: rimuovere i setter legacy, aggiungere i nuovi.
3. **draft persistence (~618)**: aggiornare la lista campi serializzati.
4. **Insert payload (~1505-1531)**: sostituire le colonne legacy con
   ```ts
   regolazione: regolazione,
   regolazione_data_presunta: regolazione ? (regolazioneDataPresunta || null) : null,
   regolazione_fattore: regolazione ? (regolazioneFattore || null) : null,
   regolazione_note: regolazione ? (regolazioneNote || null) : null,
   ```
   Lasciare `periodicita/tipo_scadenza/...` **non valorizzati** (le colonne in DB restano nullable).
5. **Render card (~2497-2550)**: sostituire il blocco con lo stesso markup di `TitoloDetail` (Switch + blocco ambra condizionale con i 3 campi). Riusare `SearchableSelect` per il Fattore con le 4 opzioni.

### Out of scope
- DB: nessuna migrazione (le colonne nuove già esistono, le legacy restano per back-compat / dati storici).
- `RegolazionePremioPage` / mode=regolazione: invariato (è un altro flusso, regolazione **eseguita**).
- Libro Matricola: rimane gestito altrove dal selettore "Tipo Operazione".
