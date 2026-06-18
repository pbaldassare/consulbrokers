## Obiettivo

Allineare il dettaglio cliente al modello **Polizza vs Quietanza** (memoria `polizza-vs-quietanza-filtering` + `quietanza-isolation`): trasformare l'unico tab "Polizze · Quietanze" in **due tab separati**, mantenendo l'esperienza completa ma con responsabilità chiare.

## Cosa cambia (solo `src/pages/ClienteDetail.tsx`)

### Tabs (riga ~2017)

Prima:
```
[Polizze (3) · Quietanze (3)]
```

Dopo:
```
[Polizze (3)] [Quietanze (3)]
```

Default attivo: **Polizze** (è la vista "principale", ma la sezione Quietanze contiene comunque tutte le rate flat).

### Tab "Polizze" (contratti = madri)

- Toolbar: rimuovo il filtro `Tipo` (non serve più, qui sono solo madri).
- KPI: `N polizze · totale premio annuo · totale provvigioni annue` (calcolati sulle sole madri filtrate).
- Filtri di ricerca: invariati (N. polizza/Targa, Gruppo Ramo, Garanzia, Agenzia, Stato).
- Tabella: una riga per ogni **madre**, badge `Polizza`, niente chevron/accordion, niente righe figlie. Colonna extra "Quietanze" con il count (es. `2`) cliccabile che porta al tab Quietanze pre-filtrando sulla polizza madre.
- Azioni admin: elimina polizza+quietanze (come oggi `handleDeleteMadre`).

### Tab "Quietanze" (rate)

- Toolbar: rimuovo il filtro `Tipo`.
- KPI: `N quietanze · totale premio incassato/da incassare · totale provvigioni`.
- Filtri: stessi attuali + nuovo filtro `Polizza madre` (SearchableSelect popolato dalle madri del cliente, deep-link via querystring `?polizzaMadre=<id>`).
- Tabella: vista **flat** (riuso di `flatQuietanze`), badge `Quietanza N`, colonna "Polizza madre" cliccabile (`numero_titolo` della madre → naviga a `/titoli/<madreId>`).
- Azioni admin: elimina singola quietanza (`handleDeleteRata`).

### Stato condiviso

- Mantengo i `useState` dei filtri al livello del componente `PolizzeClienteTab` ma lo splitto in due sotto-componenti `PolizzeTab` e `QuietanzeTab` che condividono `catene`/`filteredCatene` via props (la query `polizze_cliente` resta unica, niente refetch).
- `filtroTipo` viene eliminato dallo state.
- Il conteggio Tabs in alto (`nPol`, `nQuiet`) resta calcolato come oggi.

### Memoria

Aggiorno `mem://insurance/polizza-vs-quietanza-filtering` aggiungendo: "Nel dettaglio cliente le due viste sono tab separati (`Polizze` / `Quietanze`), non più un unico tab con filtro Tipo. Carico/Attive/Storico restano col filtro Tipo unificato."

## Fuori scope

- Nessuna modifica a `PortafoglioCarico/Attive/Storico` (lì il filtro Tipo unificato resta come da memoria).
- Nessuna modifica a query, RLS, schema o logica di eliminazione.
- Nessuna modifica al portale cliente (`src/pages/cliente/ClientePolizze.tsx`).

## File toccati

- `src/pages/ClienteDetail.tsx` (refactor del componente interno `PolizzeClienteTab` → split in due, modifica `<TabsTrigger>` e relativi `<TabsContent>`).
- `.lovable/memory/insurance/polizza-vs-quietanza-filtering.md` (aggiornamento riga sul dettaglio cliente).