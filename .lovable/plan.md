
## Diagnosi

L'utente seleziona un cliente (AMICI DI CAPODIMONTE ASS.NE ONLUS) ma il campo **Sede (Ufficio)** resta vuoto. Lo stesso vale probabilmente per Produttore/Specialist. Secondo la memoria `policy-data-inheritance`, la selezione del cliente DEVE auto-popolare Sede, Produttore (AE) e Specialist (Backoffice) dai dati anagrafici del cliente.

## Esplorazione necessaria

Devo verificare in `ImmissionePolizzaPage.tsx`:
1. Cosa fa l'handler `onChange` del SearchableSelect cliente
2. Se legge i campi `ufficio_id`, `ae_id`/`produttore_id`, `backoffice_id` dal record cliente
3. Se chiama `form.setValue()` su sede/produttore/specialist
4. Se la query del cliente seleziona effettivamente quei campi

Probabili cause:
- L'handler non legge/setta i campi derivati
- La query cliente non include `ufficio_id`/`ae_id`/`backoffice_id`
- I nomi colonna in DB sono diversi (`sede_id`? `profilo_id`?)

## Soluzione

In `ImmissionePolizzaPage.tsx`:
1. Estendere la query cliente per includere `ufficio_id`, `ae_id` (o `produttore_id`), `backoffice_id`
2. Nell'handler di selezione cliente, fare `form.setValue("ufficio_id", cliente.ufficio_id)` e analoghi per AE/Backoffice
3. Stesso comportamento dopo creazione cliente via "Nuovo Cliente"
4. Se i valori sono già impostati manualmente, **non sovrascrivere** (opzionale: chiedere conferma)

## File toccati

- `src/pages/ImmissionePolizzaPage.tsx` — fix handler selezione cliente + query

## Cosa NON cambia

- Schema DB, struttura form, lookup tables
- Layout UI

## Nota

Verifico in fase di implementazione i nomi colonna esatti in `clienti` (potrebbe essere `ufficio_id` + `ae_id` o naming diverso) prima di scrivere il setValue.
