## Obiettivo
Eliminare le polizze demo del Comune di Varese che hanno premio a 0, in modo che i conteggi/totali del portafoglio restino corretti.

## Polizze da eliminare (premio_netto = 0 e premio_lordo = 0)

| Numero | Prodotto | Note |
|---|---|---|
| DEMO-VA-2026-006 | RCA Scuolabus | [DEMO] Scadenza imminente |
| DEMO-VA-2026-007 | Cyber Risk PA | [DEMO] (duplicato di 2026-012 con premio reale) |

Tutte le altre polizze DEMO-VA-* hanno importi validi e restano.

## Operazioni
1. Verificare dipendenze a cascata (sinistri, appendici, documenti, movimenti, log) collegate ai 2 `titolo_id`.
2. Se presenti record collegati DEMO, rimuoverli prima per evitare violazioni FK.
3. `DELETE FROM titoli WHERE id IN ('85aa81c4-4d7b-4d48-9ff7-543bc3735447','baa52123-1e2a-4483-b36f-0dffff0c76a3')`.
4. Verificare il count residuo polizze del Comune di Varese e ricaricare /cliente/polizze per conferma.

## Fuori scope
- Non si toccano le altre polizze DEMO con importi.
- Nessuna modifica UI o di business logic.
