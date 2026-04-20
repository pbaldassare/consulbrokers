

## Obiettivo

Sbloccare il rinnovo correggendo l’errore:

`movimenti_polizza_sostituisce_id_fkey`

## Causa individuata

Non è più un problema RLS: ora il blocco è un **foreign key**.

Nel dialog di rinnovo, l’insert su `movimenti_polizza` sta salvando:

```ts
sostituisce_id: t.id
```

Ma `t.id` è l’ID della tabella `titoli`, mentre `sostituisce_id` punta a:

```text
movimenti_polizza.id
```

Quindi stiamo scrivendo un ID della tabella sbagliata.

## Fix che implementerò

1. **Correggere la logica del rinnovo** in `src/components/polizze/RinnovoTitoloDialog.tsx`
   - prima dell’insert del nuovo movimento, cerco il **movimento origine** della polizza corrente in `movimenti_polizza`
   - recupero il movimento più pertinente del titolo attuale (tipicamente l’ultimo per `riga` / data)
   - uso il suo `id` come `sostituisce_id`

2. **Fallback sicuro**
   - se per qualche motivo non esiste un movimento origine, non userò `t.id`
   - inserirò il nuovo movimento con `sostituisce_id: null` invece di rompere il rinnovo

3. **Legame bidirezionale opzionale**
   - dopo la creazione del nuovo movimento, valuto anche l’update del movimento origine con:
   - `sostituito_da_id = nuovoMovimento.id`
   - così la catena storico/rinnovo resta coerente anche lato movimenti

4. **Lasciare invariato il legame tra titoli**
   - su `titoli` i campi:
   - `sostituisce_polizza`
   - `sostituisce_riga`
   restano corretti e non vanno toccati

## File coinvolto

- `src/components/polizze/RinnovoTitoloDialog.tsx`

## Dettaglio tecnico

Oggi il codice fa questo:

```ts
sostituisce_id: t.id
```

ma lo schema dice:

```text
movimenti_polizza.sostituisce_id -> movimenti_polizza.id
```

Quindi il fix corretto è:

```text
1. query del movimento origine del titolo corrente
2. insert nuovo movimento con sostituisce_id = movimentoOrigine.id
3. mai usare titolo.id dentro sostituisce_id
```

## Verifica che farò dopo l’implementazione

1. Apro il rinnovo da una polizza esistente
2. Confermo il rinnovo
3. Verifico che:
   - il nuovo `titolo` venga creato
   - il nuovo `movimenti_polizza` venga creato senza errore FK
   - il collegamento storico tra vecchio e nuovo movimento sia coerente
   - il nuovo titolo appaia correttamente nel dettaglio/scadenziario

## Cosa NON faccio

- Non modifico le policy RLS: questo errore non dipende da RLS
- Non tocco lo schema database se non serve
- Non cambio la logica di messa a cassa del titolo originale

