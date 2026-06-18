## Obiettivo
Quando dal portale cliente si clicca su una polizza in `/cliente/polizze`, aprire una pagina di dettaglio completa con tutti i "dati generali" della polizza (oggi `ClientePolizzaDetail.tsx` mostra solo 9 campi base).

## Cosa fare

### 1. Arricchire `src/pages/cliente/ClientePolizzaDetail.tsx`
Mantenere il layout attuale (header verde + card "Dati Polizza" + Documenti + Sinistri) e aggiungere sezioni informative read-only con i campi che il cliente si aspetta di vedere:

- **Anagrafica polizza**
  - Numero polizza, Compagnia / Agenzia, Ramo / Garanzia, Prodotto, CIG, Targa/Telaio, Stato, Tipo portafoglio, Vincolo, Produttore

- **Durata & rinnovo**
  - Decorrenza (`durata_da`), Scadenza (`durata_a` / `data_scadenza`), Anni durata, Frazionamento (`periodicita`), Tacito rinnovo, Disdetta (mesi), Regolazione, Indicizzata

- **Premio annuo (riferimento)**
  - Premio netto, Tasse, Addizionali, SSN, Premio lordo, Provv. firma, Provv. quietanza (read-only)

- **Quietanze / rate**
  - Tabella delle quietanze collegate (rata, decorrenza, scadenza, premio lordo, stato, data incasso) — query su `quietanze` per `titolo_id`/`polizza_id`. Nessuna azione, solo lettura.

- **Stato contratto**
  - Data sospensione, data riattivazione, data annullamento, motivo annullamento (se valorizzati)

- **Note** (se presenti)

### 2. Query
Estendere il `select` da `titoli` a `select("*, compagnie(nome, codice), rami(codice, descrizione)")` (già `*` di fatto ok) e aggiungere fetch parallela su `quietanze` filtrata per `titolo_id = id` ordinata per `numero_rata`. Continuare a usare `get_my_cliente_ids` lato lista; il detail è già protetto da RLS cliente.

### 3. Click sulla riga
La navigazione esiste già (`_detailPath = /cliente/polizze/${t.id}`) ma è implementata con `<Link>` annidati in ogni `<TableCell>`. Sostituire con un singolo handler a livello di `<TableRow>` (`onClick={() => navigate(detailPath)}`) per evitare anomalie di accessibilità e garantire che il click funzioni ovunque sulla riga.

### 4. Fuori scopo (per non rompere)
- Niente azioni (messa a cassa, sospensione, annullamento) — il portale cliente resta read-only.
- Niente modifiche a `ClientePolizze` oltre al fix del click.
- Niente modifiche a RLS o schema.

## File toccati
- `src/pages/cliente/ClientePolizzaDetail.tsx` (riscrittura sezioni informative)
- `src/pages/cliente/ClientePolizze.tsx` (solo: TableRow clickabile)
