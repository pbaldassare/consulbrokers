## Modifiche a `src/pages/ClienteDetail.tsx` — tabella "Polizze del cliente"

Due ritocchi nella sezione `PolizzeClienteTable`:

### 1. Nuova colonna "Provvigioni €"
- Estendere la `select` in `queryFn` (riga ~1651) aggiungendo `provvigioni_firma`, `provvigioni_quietanza`, `targa_telaio`.
- Aggiungere `<TableHead>Provvigioni €</TableHead>` subito dopo `Premio €` (riga ~1273).
- Per ogni riga (madre e rate, sia nella vista "Solo quietanze" che nella vista standard) aggiungere `<TableCell className="font-mono">{fmtNum((t.provvigioni_firma||0) + (t.provvigioni_quietanza||0))}</TableCell>` accanto a quella del premio.
- Aggiornare i `colSpan` da `10/9` a `11/10`.
- Aggiornare il mini-KPI in alto a destra: oltre a "totale premio" aggiungere "totale provvigioni € X.XX" calcolato come `filteredTitoli.reduce((s,p) => s + (Number(p.provvigioni_firma)||0) + (Number(p.provvigioni_quietanza)||0), 0)`.

### 2. Ricerca per Targa nel filtro "N. Polizza"
- Rinominare label e placeholder del campo `filtroNumero` in "N. Polizza / Targa" e "Cerca numero o targa…".
- In `matchTitolo` estendere il check: il filtro passa se il testo è contenuto in `numero_titolo` **oppure** in `targa_telaio` (case-insensitive).

Nessun'altra modifica: niente DB, niente altri componenti, niente cambi di business logic.
