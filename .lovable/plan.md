## Problema

Oggi nelle viste portafoglio (Carico del Mese, Attive, Storico) **Polizze (madri)** e **Quietanze (rate successive)** sono mescolate nella stessa lista, senza marcatore visivo né filtro. L'utente le vuole gestire come due concetti distinti ma collegati.

Nel modello dati la distinzione esiste già:
- **Polizza (madre)** → `titoli.sostituisce_polizza IS NULL`
- **Quietanza (rata)** → `titoli.sostituisce_polizza` valorizzato (punta alla madre della catena)

La view `v_portafoglio_titoli` già espone `sostituisce_polizza` e `sostituisce_riga`, quindi nessuna modifica DB necessaria.

## Cosa propongo

### 1. Filtro "Tipo titolo" su tutte le pagine portafoglio
In `PortafoglioCaricoPage.tsx`, `PortafoglioAttivePage.tsx`, `PortafoglioStoricoPage.tsx` aggiungo un select accanto al filtro Stato:

```
Tipo: [ Tutti ▾ ]   →  Tutti | Solo polizze | Solo quietanze
```

Default = **Tutti** (comportamento attuale invariato).

Implementazione: nella query Supabase
- `Solo polizze` → `.is("sostituisce_polizza", null)`
- `Solo quietanze` → `.not("sostituisce_polizza", "is", null)`

Il filtro entra nella `queryKey` e resetta la paginazione.

### 2. Badge "Tipo" nella tabella
Nuova colonna **Tipo** (compatta, dopo N. titolo) con badge colorato:
- **Polizza** — badge `default` (primario verde/teal)
- **Quietanza** — badge `secondary` (grigio), con tooltip "Rata della polizza N. …"

Usa l'helper esistente `isQuietanza()` da `src/lib/quietanze.ts`.

### 3. KPI card separati nella Carico del Mese
Le 2 card attuali (Polizze da rinnovare / Totale premio) diventano **4** in griglia 4-col:
- **Polizze**: N°, totale €
- **Quietanze**: N°, totale €

Calcoli lato server con due query parallele aggregate (somma `premio_lordo` filtrando per `sostituisce_polizza`).

### 4. Lo stesso pattern viene applicato a:
- `PortafoglioAttivePage.tsx` (filtro + colonna Tipo)
- `PortafoglioStoricoPage.tsx` (filtro + colonna Tipo)
- `TitoliList.tsx` (se rilevante — lo verifico in implementazione)

### 5. Cosa NON cambia
- View DB `v_portafoglio_titoli` invariata
- Logica di messa a cassa, auto-quietanza, RLS, calcolo provvigioni: tutto invariato
- Il dettaglio cliente (`ClienteDetail` PolizzeClienteTable) usa già il raggruppamento madre/rate con expand: lì lo lascio così
- Niente nuove tabelle, niente migration

## Note tecniche
- `sostituisce_polizza` non è indicizzato esplicitamente nella view, ma essendo già nei `WHERE` di trigger esistenti è performante anche per filtri lato view.
- Aggiungo `tipoLabel`/`isQuietanza` (già in `src/lib/quietanze.ts`) come unica fonte di verità per il render del badge.

Confermi e procedo?