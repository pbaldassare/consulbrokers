## Obiettivo

Spostare la generazione delle quietanze **dall'evento "messa a cassa" al momento della creazione della polizza madre**. Alla creazione, in base a `frazionamento` + `anni_durata`, vengono pre-create tutte le rate successive come record `titoli` con `sostituisce_polizza` concatenato. La messa a cassa diventa un evento separato per ogni singola rata.

## Mappa frazionamento → numero rate

Rate totali per polizza (madre inclusa):

| Frazionamento | Mesi rata | Rate / anno | Totale rate per `anni_durata = N` |
|---|---|---|---|
| Mensile | 1 | 12 | `12 * N` |
| Trimestrale | 3 | 4 | `4 * N` |
| Quadrimestrale | 4 | 3 | `3 * N` |
| Semestrale | 6 | 2 | `2 * N` |
| Annuale | 12 | 1 | `1 * N` |
| Poliennale | `N*12` | 1 | `1` (solo madre, invariato) |

La **madre** copre la 1ª rata. Le **quietanze pre-create** sono `(totale - 1)`.

Esempi:
- Annuale, 1 anno → solo madre (0 quietanze).
- Annuale, 3 anni → madre + 2 quietanze annuali.
- Semestrale, 1 anno → madre + 1 quietanza.
- Trimestrale, 1 anno → madre + 3 quietanze.
- Mensile, 1 anno → madre + 11 quietanze.
- Poliennale → solo madre (eccezione confermata).

## Modifiche

### 1. DB — nuovo trigger `genera_quietanze_su_insert_madre`

`AFTER INSERT` su `public.titoli`, solo quando `NEW.sostituisce_polizza IS NULL` (madre).

Logica della funzione `SECURITY DEFINER`:
1. Calcola `n_rate_totali` da `NEW.frazionamento` e `NEW.anni_durata` (helper SQL replicato da `lib/frazionamento.ts`).
2. Se `n_rate_totali <= 1` o frazionamento poliennale → esce.
3. Loop `i = 2 .. n_rate_totali`:
   - `garanzia_da_i = NEW.garanzia_da + (i-1) * mesi_rata`
   - `garanzia_a_i  = garanzia_da_i + mesi_rata` (o `NEW.garanzia_a` per l'ultima)
   - `data_competenza_i = NEW.data_competenza + (i-1) * mesi_rata` se valorizzato
   - INSERT in `titoli` clonando i campi rilevanti della madre (numero, prodotto, cliente, compagnia, ramo, importi netto/tasse/lordo/provvigioni, frazionamento, anni_durata, ufficio_id, AE, produttore, IBAN, tipo_pagamento, ecc.)
   - `sostituisce_polizza` = id della rata precedente (i-1), `stato = 'attivo'`, `data_messa_cassa = NULL`, `data_incasso = NULL`.
4. Disabilita re-entrancy con un guard `app.in_generate_quietanze` (`SET LOCAL`) per evitare ricorsione sull'insert delle figlie.

### 2. DB — aggiornamento `genera_quietanza_su_messa_cassa`

Il trigger esistente diventa **fallback retro-compatibile**: la skip rule "se la successiva esiste già" è già presente → in pratica con il nuovo flusso non genera più nulla. Lo lasciamo attivo solo per polizze legacy senza catena pre-creata (non rompe nulla).

### 3. UI — `ImmissionePolizzaPage`

- Nessun cambio di form: i campi `frazionamento`, `anni_durata`, `garanzia_da/a`, `data_competenza` sono già presenti.
- Aggiungere un **pannello informativo "Quietanze che verranno generate"** sotto la sezione "Periodo": mostra una preview tabellare (idx, garanzia_da, garanzia_a, data_competenza) calcolata client-side con `lib/frazionamento.ts`, così l'utente vede in anticipo cosa verrà creato. Pannello sola lettura.
- Toast post-salvataggio: "Polizza creata. Generate N quietanze in stato attivo."

### 4. Helper condiviso

Nuovo file `src/lib/quietanzePlan.ts` (puro, testabile): funzione `computeQuietanzePlan({ frazionamento, anniDurata, garanziaDa, garanziaA, dataCompetenza })` → ritorna `Array<{ idx, garanzia_da, garanzia_a, data_competenza }>`. Usato dal pannello UI e dai test.

### 5. Test

- `src/lib/__tests__/quietanzePlan.test.ts`: tutti i casi della tabella (Mensile/Trimestrale/Semestrale/Annuale 1y e 3y, Poliennale, Quadrimestrale).
- Test edge: `garanzia_da` mancante → plan vuoto; durata invalida → fallback 1 anno.

### 6. Backfill polizze esistenti

**NON** eseguito automaticamente. Le polizze già create restano com'erano (la quietanza nasce alla messa a cassa, come oggi). Solo le polizze create **dopo** il deploy avranno la catena pre-generata. Questo evita rischi su dati storici e su polizze poliennali/anomale.

Se in futuro vorrai un backfill mirato (es. solo polizze attive senza quietanze), lo facciamo con uno script separato.

### 7. Memoria progetto

Aggiornare `.lovable/memory/insurance/auto-quietanza-su-messa-cassa.md` → rinominare a `auto-quietanza-su-creazione-polizza.md` con la nuova regola (pre-generazione all'insert madre, fallback su messa a cassa per legacy).

## Cosa NON cambia

- Importi: le quietanze pre-create ereditano gli importi della madre; restano editabili per rata (regola `quietanza-isolation` invariata).
- Messa a cassa: comportamento identico, ma ora opera su rate già esistenti invece di generare la successiva.
- Annullamento polizza: la cascade già cancella tutte le discendenti via `sostituisce_polizza` — funziona senza modifiche.
- Filtro UI Polizze/Quietanze in ClienteDetail e Portafoglio: già pronto.

## Domanda di conferma

Prima di procedere con migration + codice: confermi che:
1. **Stato iniziale** delle quietanze pre-create = `attivo` (in attesa di messa a cassa)? ✅ proposto
2. **Importi** quietanze = clonati dalla madre (modificabili dopo)? ✅ proposto
3. **Nessun backfill** sulle polizze esistenti? ✅ proposto

Se confermi questi 3 punti procedo con la migration e gli aggiornamenti UI/test.