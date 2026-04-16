

## Piano: Aggiungere ordinamento A-Z su ogni colonna della tabella Carico del Mese

### Cosa cambia
Ogni intestazione di colonna nella tabella diventa cliccabile con un'icona freccia (▲/▼) che indica la direzione dell'ordinamento. Il sorting avviene **server-side** (via Supabase `.order()`) per coerenza con la paginazione.

### Colonne ordinabili
- N° Polizza (`numero_titolo`)
- Cliente (`cliente_nome_display`)
- Compagnia (`compagnia_nome`)
- Ramo (`ramo_nome`)
- Scadenza (`data_scadenza`)
- Fraz (`rate`)
- Lordo (`premio_lordo`)
- AE (`ae_nome`)
- Produttore (`produttore_nome`)
- Stato (`stato`)
- Messa a Cassa (`data_messa_cassa`)

### Implementazione
- Nuovo state: `sortField` (default `data_scadenza`) e `sortDirection` (`asc`/`desc`)
- Click su header: se stesso campo → inverte direzione; se campo diverso → imposta `asc`
- Icona `ArrowUpDown` / `ArrowUp` / `ArrowDown` da lucide accanto al testo header
- La query Supabase usa `.order(sortField, { ascending: sortDirection === "asc" })`
- Reset pagina a 0 quando cambia ordinamento
- Componente helper `SortableHeader` inline per DRY

### File coinvolti
- ✏️ `src/pages/PortafoglioCaricoPage.tsx` — aggiunta state sorting, SortableHeader, modifica query e headers tabella

