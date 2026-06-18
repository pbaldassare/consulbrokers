Aggiungo una barra filtri sopra la tabella **Polizze del cliente** in `ClienteDetail.tsx` (componente `PolizzeClienteTable`).

## Filtri (in linea, sopra la tabella, accanto al filtro "Tipo" già esistente)
1. **Cerca N. Polizza** — input testo libero (match su `numero_titolo` della madre e delle quietanze).
2. **Gruppo Ramo** — `SearchableSelect` con i gruppi presenti nelle polizze del cliente (distinct da `ramo.gruppo_ramo.descrizione`).
3. **Garanzia** — `SearchableSelect` con le garanzie presenti (distinct da `ramo.descrizione`). Se è selezionato un Gruppo Ramo, la lista mostra solo le garanzie di quel gruppo.
4. **Agenzia** — `SearchableSelect` con le agenzie distinct da `compagnia_diretta.nome`.
5. **Stato** — `SearchableSelect` con gli stati distinct (`attivo`, `incassato`, `sospeso`, `scaduto`, `stornato`).
6. **Bottone "Pulisci filtri"** visibile quando almeno un filtro è attivo.

Tutte le opzioni dei select sono **derivate dinamicamente** dalle polizze caricate (no query aggiuntive).

## Logica
- Filtri applicati lato client su `catene` (madre + quietanze figlie).
- Una catena passa il filtro se la **madre** o **almeno una rata** soddisfa tutti i filtri attivi.
- Il contatore "X polizze · Y quietanze · totale premio €" si aggiorna sui risultati filtrati.
- Il filtro "Tipo" (Polizze + Quietanze / Solo polizze / Solo quietanze) resta com'è e si combina con i nuovi filtri.

## File toccati
- `src/pages/ClienteDetail.tsx` — solo il componente `PolizzeClienteTable` (stati nuovi, derivazione opzioni, predicate di filtro, render toolbar).

Nessuna modifica a query, schema o altri componenti.
