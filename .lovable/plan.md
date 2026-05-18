## Obiettivo

Nella dialog **Nuovo / Modifica Rapporto** (`RapportiCompagniaDialog.tsx`):

1. Permettere di selezionare **più sottorami in contemporanea** per uno stesso Ramo (multi-select), invece di dover aggiungere una riga per ogni sottoramo.
2. Quando si aggiunge un Ramo, il flag **"Tutti i sottorami" deve essere attivo di default**.
3. **Rimuovere completamente la sezione "% Provvigione"** dalla dialog: le provvigioni verranno gestite a parte (tab Provvigioni / pagina dedicata).

## Comportamento UI dopo la modifica

Sezione "Rami e Sottorami abilitati":

```text
[ Ramo: CORPI            ▼ ]   [ ☑ Tutti i sottorami ]                       [ X ]
                               (se deselezionato compare il multi-select)
                               [ ☐ AVIAZIONE CORPI                          ]
                               [ ☐ CORPI DRONE                              ]
                               [ ☐ CORPI IMBARCAZIONI DIPORTO               ]
                               [ ☐ CORPI NAUTICA                            ]
                               ...
[ + Aggiungi Ramo ]
```

- Aggiungendo un Ramo → riga creata con `ramo_id = null` (Tutti i sottorami) già attiva.
- Disattivando "Tutti" → appare un multi-select (checkbox list) per scegliere uno o più sottorami del gruppo. Internamente verranno salvate N righe in `compagnia_rapporto_rami`, una per ogni sottoramo selezionato.
- Riattivando "Tutti" → le righe specifiche di quel gruppo vengono sostituite da un'unica riga `ramo_id = null`.
- Validazione: niente duplicati gruppo+sottoramo (già presente).

Sezione "% Provvigione" (campo singolo nella riga `Data Inizio | Data Fine | % Provvigione`):

- Rimosso il campo e l'etichetta.
- La riga diventa una griglia a 2 colonne: `Data Inizio | Data Fine`.
- Il campo `percentuale_provvigione` non viene più scritto né letto dalla form (sempre `null` in save).

Nessuna modifica al database, alla tabella riepilogativa dei rapporti, alla dialog di lista, all'IBAN o all'autocomplete sede.

## Dettagli tecnici

File toccato: `src/components/compagnie/RapportiCompagniaDialog.tsx`

1. **Struttura dati interna**: invece di `RamoRow { gruppo_ramo_id, ramo_id }[]`, raggruppare per gruppo in stato locale:

   ```ts
   interface RamoGroupRow {
     gruppo_ramo_id: string;
     all: boolean;            // true => salva una riga con ramo_id null
     ramo_ids: string[];      // usato solo se all === false
   }
   ```

   - `openEdit`: leggere da `compagnia_rapporto_rami`, raggruppare per `gruppo_ramo_id`. Se esiste almeno una riga con `ramo_id = null` → `all = true, ramo_ids = []`. Altrimenti `all = false, ramo_ids = [...]`.
   - `openNew`: `[]`.
   - Pulsante "+ Aggiungi Ramo" → push `{ gruppo_ramo_id: "", all: true, ramo_ids: [] }`.

2. **Persistenza in `saveMutation`**: appiattire le righe prima dell'insert:
   - Se `all` → `{ rapporto_id, gruppo_ramo_id, ramo_id: null }`.
   - Altrimenti → una riga per ogni `ramo_id` in `ramo_ids` (se vuoto, gruppo ignorato con warning soft).
   - Mantenere l'attuale `delete + insert` per il sync.

3. **UI multi-select sottorami**: usare componente locale con `Popover` + `Command` + `CommandItem` con checkbox (pattern già in uso in `SearchableSelect`). Il trigger mostra "Tutti i sottorami" oppure il conteggio "N selezionati" + tooltip con nomi. Checkbox separata "Tutti i sottorami" sopra la lista.

4. **Rimozione % Provvigione**:
   - Eliminare il blocco JSX (riga `<div className="grid grid-cols-3 ...">` → diventa `grid-cols-2` con solo le due date).
   - Eliminare `percentuale_provvigione` da `RapportoForm`, `emptyForm`, `openEdit`, `basePayload` (passare sempre `null` per compatibilità con la colonna esistente in DB).
   - Lasciare invariata la colonna `% Provv.` nella tabella riepilogativa (mostra il valore storico se presente, "—" altrimenti).

## Fuori scope

- Tab Provvigioni separato / nuova pagina dedicata (richiesta dell'utente di gestirle "a parte"): da fare in un task successivo.
- Migrazioni DB: nessuna necessaria.
- Modifiche al matching della matrice provvigioni: già funziona espandendo `ramo_id = null` in tutti i sottorami del gruppo.
