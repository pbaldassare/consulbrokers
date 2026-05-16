# Riorganizzazione pagina Conti Bancari

## Problema attuale
- Una sola tabella con 338 righe (334 sono `tipo='compagnia'`, 3 `generico`, 1 `incasso_clienti`).
- Nessuna ricerca testuale: trovare un IBAN o una compagnia è impossibile.
- Filtro tipo presente ma il valore reale `compagnia` non è nemmeno nella lista `TIPI` (mostra "compagnia" come badge grezzo).
- Niente paginazione → render lento, scroll infinito.
- I conti "core" di Consulbrokers (incassi, provvigioni, generici) si perdono in mezzo ai 334 conti agenzia.

## Nuovo layout

Una pagina con **tab per categoria** sopra alla tabella:

```text
[Banknote] Conti Bancari                                    [+ Nuovo Conto]

┌──────────────────────────────────────────────────────────────────────┐
│ Consulbrokers (4)  │  Compagnie (334)  │  Agenzie (0)  │  Tutti      │
└──────────────────────────────────────────────────────────────────────┘

 🔎 Cerca per etichetta, IBAN, intestatario, banca…   [Solo attivi ☑]

 ┌──────────────────────────────────────────────────────────────────┐
 │ ★  Etichetta        Tipo         IBAN              Intestato a … │
 │ ────────────────────────────────────────────────────────────────  │
 │ ★  Conto Incassi…   Incasso cli  IT70…6469         Consulbrok…   │
 │ ...                                                              │
 └──────────────────────────────────────────────────────────────────┘
                                       « 1 2 3 … 14 »   25 / pagina
```

### Tab e mapping

| Tab | Tipi inclusi | Default visibile |
|---|---|---|
| **Consulbrokers** | `incasso_clienti`, `provvigioni`, `generico` | Sì, per ciascun sotto-tipo |
| **Compagnie** | `compagnia` | No (default non si applica) |
| **Agenzie** | `agenzia` | No |
| **Tutti** | — | Default per tipo |

I tab mostrano il **conteggio** tra parentesi (query separata `count: 'exact'`).

### Ricerca
- Campo di ricerca con debounce 350 ms.
- Server-side: `ilike` su `etichetta`, `iban`, `intestato_a`, `banca` con `or(...)`.

### Paginazione
- Server-side, 25 per pagina, componente `ServerPagination` già usato altrove.

### Altri miglioramenti UX
- Nella tab **Compagnie** aggiungo colonna "Compagnia collegata" (join leggero su `compagnie.conto_bancario_id` → ragione sociale) per capire a chi appartiene il conto.
- Badge `Default` solo nelle tab dove ha senso (Consulbrokers, Tutti).
- Aggiungo `compagnia` e `agenzia` al dizionario `TIPI` così il badge non mostra più il valore raw.
- Empty state per tab vuota: testo + bottone "Nuovo conto di questa categoria" (pre-imposta il `tipo` nel form).

## Dettagli tecnici

File toccato: `src/pages/anagrafiche/ContiBancariPage.tsx` (solo presentazione, niente schema/RLS).

- Stato: `categoria` ('consul' | 'compagnie' | 'agenzie' | 'all'), `search` (debounced), `page`, `soloAttivi`.
- Query principale: `select('*', { count: 'exact' })` con `.in('tipo', tipiTab)` + `or(...ilike)` + `.range()`.
- Conteggi tab: una query `select('tipo', { count: 'exact', head: true })` per ognuno, oppure unica RPC; per semplicità 3 query in parallelo con `useQueries`, `staleTime` 60 s.
- Mantengo dialog di creazione/modifica e `DeleteWithImpactDialog` invariati. Il form già ha `tipo` come Select → aggiungo `compagnia` e `agenzia` alle opzioni (read-only se editi un conto collegato a un'agenzia/compagnia).
- Nessuna modifica alla logica `is_default` / catena IBAN.

## Fuori scope
- Refactor backend, nuove tabelle, nuove RLS.
- Modifiche alla pagina IBAN dei profili Specialist o Sedi.
