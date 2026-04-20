

## Problema

L'utente ha modificato il premio lordo della polizza a **3907,72**, ma il dialog di rinnovo mostra ancora **1907,72** (vecchio valore). Quindi il refetch all'apertura del dialog non sta funzionando, o sta leggendo da una vista/cache stale.

## Verifiche da fare

1. **Leggere `RinnovoTitoloDialog.tsx`** per controllare:
   - Come è scritto il `useEffect` di refetch
   - Da quale tabella/vista legge (`titoli` diretto o vista `v_portafoglio_titoli`?)
   - Se i campi `premio_lordo`, `premio_lordo_quietanza`, `premio_netto_quietanza`, `tasse_quietanza` esistono e da quali parte
   - L'ordine: stato del form vs dipendenze dell'effect (potrebbe avere `[titolo.id]` invece di `[open, titolo.id]`)

2. **Query DB diretta** sul titolo `9cf0ec5e-3fa4-414f-b01e-18cfb032f7d5` per verificare i valori reali in DB (premio_lordo, premio_netto, tasse, e relativi campi `_quietanza`).

## Cause possibili

- **A) Dialog legge da una vista** (`v_portafoglio_titoli`) che non si aggiorna in real-time → fix: leggere direttamente da `titoli`.
- **B) `useEffect` ha dipendenze sbagliate** (es. solo `[titolo.id]`) → quando l'utente riapre il dialog senza ricaricare la pagina, l'effect non si ritriggera → fix: aggiungere `open` nelle deps + reset form quando `open=false`.
- **C) I campi `_quietanza` in DB non sono stati aggiornati** quando l'utente ha modificato il premio dal form di edit della polizza → quindi il refetch funziona, ma legge i valori firma vecchi mentre la UI mostra il nuovo `premio_lordo`. Fix: usare il `premio_lordo` aggiornato come fonte di verità (non solo i campi `_quietanza`).
- **D) Stato iniziale del `useState`** calcolato dalle props al mount e mai resettato → fix: resettare lo state quando arrivano dati freschi.

Probabilmente è un mix di **B + C**: l'edit della polizza aggiorna `premio_lordo` ma non i campi `_quietanza`, e il dialog usa `_quietanza ?? premio_*` quindi prende il vecchio quietanza.

## Fix previsto

In `src/components/polizze/RinnovoTitoloDialog.tsx`:

1. **Refetch sempre da `titoli`** (non da viste) all'apertura, con `select("*")`.
2. **Dipendenze effect**: `[open, titolo.id]` + reset `loading` state.
3. **Logica premium base invertita**: usare `premio_lordo ?? premio_lordo_quietanza` (cioè il valore corrente come prima fonte) — perché `premio_lordo` è quello che l'utente vede e modifica nella UI principale. Stessa cosa per `premio_netto`, `tasse`, `provvigioni`.
4. **Forzare reset del form** quando arrivano dati freschi: invece di `useState(initial)` usare `useEffect` che fa `setForm(...)` ogni volta che `fresh` cambia.

## File toccato

- `src/components/polizze/RinnovoTitoloDialog.tsx` (~15 righe)

## Cosa NON faccio

- Niente DB / RLS / migrazioni
- Nessun cambio ad altri flussi (immissione, appendici, storno)

## Verifica post-fix

1. Modifico premio lordo della polizza a un nuovo valore (es. 3907,72)
2. Apro il dialog di rinnovo → vedo **3907,72** pre-compilato (non più 1907,72)
3. Confermo → il nuovo titolo ha 3907,72

