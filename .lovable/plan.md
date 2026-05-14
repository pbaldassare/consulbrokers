## Obiettivo
Garantire che ogni quietanza (rata) sia gestita come record indipendente: salvataggio scoped al singolo `titoli.id`, nessuna propagazione verso madre o rate sorelle, e UI che lo rende evidente.

## Contesto attuale (verifiche fatte)
- Ogni quietanza è già una riga separata in `titoli` (chiave `numero_titolo` + `riga`, link via `sostituisce_polizza`).
- Tutte le mutation in `TitoloDetail.tsx` usano `.update(...).eq("id", id!)` → niente bulk update per `numero_titolo`.
- `premi_garanzia_polizza` è scoped per `titolo_id`; `VociRcaCard` filtra per `titolo_id` + `tipo_premio`.
- Nessun trigger DB propaga modifiche tra quietanze (il trigger `genera_quietanza_su_messa_cassa` crea SOLO il record successivo, non aggiorna i fratelli).

Tecnicamente la propagazione non avviene già oggi. Quindi il lavoro è di **hardening + chiarezza UI** per eliminare ambiguità percepite.

## Cosa cambia

### 1. Hardening salvataggi `TitoloDetail`
- In ogni `mutationFn` di salvataggio (importi, periodo, contratto, regolazione, split commerciali) aggiungere all'inizio un **assert difensivo**: rifiutare se manca `id` o se `id !== titolo.id`. Log esplicito in console se discrepanza.
- Le UPDATE restano `.eq("id", titolo.id)` (nessuna `.eq("numero_titolo", ...)` da nessuna parte — già verificato).

### 2. Sync Firma → Quietanza: limitare alla madre
Oggi in `saveImportiMutation` (righe 929-952) c'è la sincronizzazione automatica Firma→Quietanza dello stesso record.
- Disattivare questa sync quando il titolo corrente è una **quietanza** (`isQuietanza(t)` da `src/lib/quietanze.ts`): su una rata l'utente modifica solo i campi quietanza, mai i firma → la sync non deve scattare.
- Sulla madre la sync rimane invariata.

### 3. UI chiara nel `TitoloDetail`
- Banner sticky in cima al detail, sopra le PolizzaSection, **solo se il titolo è una quietanza**: testo "Stai modificando la **Rata N** del **gg/mm/aaaa → gg/mm/aaaa**. Le modifiche valgono solo per questa rata, non per la polizza madre o le altre rate." con link "Vai alla polizza madre".
- Sulla madre, banner equivalente: "Polizza madre — le rate hanno premi/dati propri. [Vedi N rate]" con anchor che apre il pannello sotto.
- Nuovo pannello "Quietanze di questa polizza" (collapsible, default chiuso) dentro `TitoloDetail`: tabella delle righe con stesso `numero_titolo`, ordinate per `garanzia_da`, ognuna cliccabile verso `/titoli/:id`. Mostra: tipo (Polizza/Rata N), periodo, premio lordo, stato, data_messa_cassa. La tabella corrente sotto sarà evidenziata.
- Riusa `groupTitoliByPolizza` da `src/lib/quietanze.ts`.

### 4. Test
- Aggiungere test (`vitest`) in `src/components/polizze/__tests__/` che simula 1 madre + 2 quietanze e verifica che update sull'id rata non tocchi madre/sorelle (mock supabase).

## Out of scope
- Nessuna modifica DB (trigger, schema, RLS).
- Nessuna modifica al trigger `genera_quietanza_su_messa_cassa` (continua a copiare i dati dalla madre alla nuova rata SOLO al momento della creazione).
- Nessuna modifica a `PolizzeClienteTable` (già nidificata correttamente).
- Nessuna modifica al PDF E/C in corso.
