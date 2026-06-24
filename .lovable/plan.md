## Obiettivo

Rimuovere la colonna **"Anticipo"** dalle tre pagine Portafoglio (Carico, Polizze Attive, Storico Polizze), come richiesto dalla schermata.

## Note sui filtri di ricerca

Nessuna delle tre pagine espone un **filtro** "Anticipo" tra i controlli di ricerca (i filtri attuali sono solo: Mese Corrente / Messe a Cassa / Tutte, Tutti / Quietanze / Regolazioni, ricerca testuale e date Dal/Al). Quindi l'unica modifica concreta è togliere la **colonna** "Anticipo" dalla tabella.

## Modifiche per file

### `src/pages/PortafoglioCaricoPage.tsx`
- Header tabella (riga ~661): rimuovere `<TableHead>Anticipo</TableHead>`.
- Riga tabella (riga ~720): rimuovere la `<TableCell>` con il pulsante che apre `AnticipoUtilizziDrawer`.
- Rimuovere l'import `AnticipoUtilizziDrawer` (riga 28), lo state `anticipoDrawerId` (riga 204) e il componente drawer in fondo (riga ~816-819) — non più referenziati.
- Pulire eventuali fetch/summary `primoAnticipoId` se usati solo per quella cella.

### `src/pages/PortafoglioAttivePage.tsx`
- Header tabella (riga ~193): rimuovere `<TableHead>Anticipo</TableHead>`.
- Riga tabella (riga ~244): rimuovere la `<TableCell>` del pulsante anticipo.
- Rimuovere import (riga 20), state `anticipoDrawerId` (riga 91) e drawer in fondo (riga 273).

### `src/pages/PortafoglioStoricoPage.tsx`
- Header tabella (riga ~209): rimuovere `<TableHead>Anticipo</TableHead>`.
- Riga tabella (riga ~257): rimuovere la `<TableCell>` del pulsante anticipo.
- Rimuovere import (riga 19), state `anticipoDrawerId` (riga 100) e drawer in fondo (riga 305).

## Cosa NON cambia

- Logica/hook `useAnticipiCliente`, drawer `AnticipoUtilizziDrawer` (resta usato in `RiepilogoAnticipiPage`, `RicongiungimentoBancarioPage`, `MessaCassaDialog`, `ClienteDetail`).
- Logica di messa a cassa con utilizzo anticipi (resta intatta).
- Filtri, sort, paginazione, azioni bulk.
- ClienteDetail (non ha colonna "Anticipo" nelle quietanze).

## Risultato

Nuovo ordine colonne **Carico**:
`☑ · N° Polizza · Tipo · Cliente · Agenzia · Garanzia · Inizio Garanzia · Fine Garanzia · Targa · Fraz · Lordo · AE · Produttore · Stato · Messa a Cassa · [azioni]`

Nuovo ordine **Attive**:
`N° Polizza · Tipo · Cliente · Agenzia · Garanzia · Inizio Garanzia · Fine Garanzia · Targa · Fraz · Lordo · Attive · Passive · AE · Specialist · Produttore`

Nuovo ordine **Storico**:
`N° Polizza · Tipo · Cliente · Agenzia · Garanzia · Inizio Garanzia · Fine Garanzia · Targa · Fraz · Lordo · Attive · Passive · AE · Stato · Dt. Sosp. · Lim. Riatt.`
