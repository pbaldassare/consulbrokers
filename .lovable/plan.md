# Filtri Dal/Al + Reset Filtri — pagina Carico

## Cosa cambia

1. **Rimuovo il navigatore mensile** ("‹ Giugno 2026 ›") in alto a destra del titolo.
2. **Aggiungo due date picker `Dal` / `Al`** nella riga filtri (accanto a ricerca, toggle periodo, Polizze+Quietanze). Vuoti al primo caricamento → nessun filtro data attivo → mostra tutte le polizze (sotto la logica del toggle).
3. **Pulsante `Reset Filtri`** (icona `RotateCcw` + label) accanto agli altri controlli, visibile solo se almeno uno tra: `dateDa`, `dateA`, `search`, `filtroPeriodo ≠ "mese_corrente"`, `filtroTipo ≠ "tutti"` è attivo. Cliccandolo:
   - svuota `dateDa`, `dateA`
   - `filtroPeriodo` → `"mese_corrente"` con `userTouched=false` (default esteso ripristinato)
   - `search` → `""`
   - `filtroTipo` → `"tutti"`
   - rimuove i query param da URL (`periodo`, `dal`, `al`)

## Logica filtro data (sostituisce `caricoStart`/`caricoEnd` derivati dal mese)

Al posto di `caricoStart = startOfMonth(caricoDate)` e `caricoEnd = endOfMonth(caricoDate)`, uso direttamente `dateDa` / `dateA` come bordi:

- `dateDa` vuoto → nessun `gte` sulla data
- `dateA` vuoto → nessun `lte` sulla data
- entrambi vuoti → query senza vincolo temporale (la condizione su `stato` resta in base al toggle)

Riscrivo `applyPeriodoFilter(q)`:
- `messe_cassa`: `stato='incassato'` + (`data_messa_cassa >= dateDa` se set) + (`data_messa_cassa <= dateA` se set)
- `tutte`: `stato in (attivo, incassato)` + `or(and(stato.eq.attivo, data_scadenza ≤ dateA?), and(stato.eq.incassato, data_messa_cassa ≥ dateDa?, data_messa_cassa ≤ dateA?))` — con i bordi opzionali rimossi se vuoti
- `mese_corrente`:
  - default esteso (`!userTouched && entrambe le date vuote`): `stato='attivo'` senza limite inferiore, nessun limite superiore → "tutte le attive (incluso arretrati)"
  - se utente ha selezionato date: `stato='attivo'` + bordi `dateDa`/`dateA` come `gte`/`lte` su `data_scadenza`
  - se utente ha toccato il toggle ma date vuote: `stato='attivo'`, nessun bordo

## Sottotitolo dinamico

`<p>` sotto "Carico" diventa:
- entrambe le date vuote: "Tutte le polizze" (+ "· inclusi arretrati non a cassa" solo se `isDefaultExtended`)
- `dateDa`/`dateA` set: "Polizze [in scadenza|messe a cassa] dal {dateDa} al {dateA}" (formattate `dd/MM/yyyy`)

## URL persistence

Aggiungo `?dal=YYYY-MM-DD&al=YYYY-MM-DD` sincronizzati con i picker (sia in scrittura sia in lettura iniziale). `Reset Filtri` pulisce anche questi.

## Query keys

`["portafoglio-carico", search, filtroPeriodo, isDefaultExtended, filtroTipo, page, dateDa, dateA, sortField, sortDirection]` e analogamente `["portafoglio-carico-totale", ...]` → ricalcolo automatico contatori.

## File toccato

- `src/pages/PortafoglioCaricoPage.tsx` (unico file)

## Fuori scope

- `MessaCassaDialog`, paginazione, RLS, query "in attesa rinnovo" (resta indipendente dal filtro data come oggi)
- Renaming/sidebar (già fatto in precedenza)
- Altre pagine portafoglio (Attive, Storico)
