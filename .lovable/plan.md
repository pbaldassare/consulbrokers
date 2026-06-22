## Modifiche tabella "Polizze del cliente" (tab Polizze in ClienteDetail)

Nel file `src/pages/ClienteDetail.tsx`, sezione tabella polizze/quietanze (righe ~1278-1468):

### Colonne da rimuovere
1. **Polizza madre** — è un doppione del numero polizza/della catena già visibile. Rimuovo header e celle nelle 3 varianti di riga (quietanza flat, polizza madre, rata espansa).
2. **Stato** — non serve. Rimuovo header e badge stato nelle 3 varianti.

### Colonne da aggiungere (solo per le quietanze)
3. **Inizio Garanzia** → `r.data_decorrenza` della quietanza
4. **Fine Garanzia** → `r.data_scadenza` della quietanza

Posizionamento: subito dopo la colonna **Garanzia**, prima di Agenzia.

Per le righe **polizza madre** (non quietanza) le due nuove colonne mostreranno `—` (la richiesta è esplicita: date della quietanza). Le polizze hanno già le proprie date visibili nel dettaglio.

### Cosa NON tocco
- Il filtro "Stato" in alto resta (utile per filtrare polizze attive/incassate dietro le quinte) — se vuoi lo rimuovo anche.
- Nessuna modifica a logica dati, query, navigazione.
- Nessuna modifica DB.

### Risultato colonne finali
`N. Polizza · Tipo · Gruppo Ramo · Garanzia · Inizio Garanzia · Fine Garanzia · Agenzia · Premio € · Provvigioni € · Data Incasso · [🗑 admin]`
