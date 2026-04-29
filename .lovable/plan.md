## Obiettivo
Nel modal "Nuovo Cliente" (`src/pages/ClientiList.tsx`) il primo campo diventa **Gruppo Finanziario** (searchable). Selezionandolo, il **Tipo Cliente** viene impostato automaticamente in base a `gruppi_finanziari.tipo_soggetto` e mostrato come badge read-only (non più dropdown modificabile). Il resto del form (sezioni Privato/Azienda/Ente) reagisce come oggi al `tipoCliente` derivato.

## Modifiche

### 1. Query gruppi finanziari
`src/pages/ClientiList.tsx` linea 328: aggiungere `tipo_soggetto` allo `select`:
```
.select("id, codice, nome, tipo_soggetto")
```

### 2. Sostituire blocco "Tipo Cliente" in cima al dialog (linee 622-633)
Nuovo layout:
- **Gruppo Finanziario** (SearchableSelect, full width) — primo campo subito sotto il titolo
- Sotto, **Tipo Cliente**: badge colorato read-only (Privato/Azienda/Ente) che riflette `tipoCliente`. Se nessun gruppo selezionato → badge "Seleziona un gruppo finanziario" disabled
- Handler `onChange`: trova il gruppo, fa `setGruppoFinanziarioId(id)` e `setTipoCliente(gruppo.tipo_soggetto)`. Se il gruppo non ha `tipo_soggetto`, lascia invariato il tipo corrente

### 3. Rimuovere il duplicato dentro "Dati Statistici"
Nel sub-component `DatiStatisticiCreate` il campo Gruppo Finanziario rimane visibile per coerenza con la sezione statistica? → Sì, ma diventa sincronizzato con quello in alto (stesso state, già condiviso via props). Nessun cambio funzionale, solo verifica che modificandolo da lì venga aggiornato anche `tipoCliente`. Soluzione: passare anche `setTipoCliente` e `gruppiFinanziari` (già passato) al sub-component, e nel suo handler aggiornare entrambi. In alternativa, rendere il campo in DatiStatistici solo visualizzazione (read-only) per evitare doppio punto di edit.

**Scelta**: rendere il campo dentro DatiStatistici read-only/disabled, perché ora il vero punto di selezione è in cima. Mostra solo il valore selezionato.

### 4. Memoria
Aggiornare `mem://insurance/gruppi-finanziari-tipo-soggetto.md` per documentare:
- Nel form Nuovo Cliente, Gruppo Finanziario è il primo campo (searchable) e Tipo Cliente è derivato/read-only
- Stessa logica già presente in `ClienteDetail.tsx` (modifica esistente)

## File toccati
- `src/pages/ClientiList.tsx`
- `.lovable/memory/insurance/gruppi-finanziari-tipo-soggetto.md`

## Note
- Nessuna migrazione DB necessaria (`tipo_soggetto` già esiste su `gruppi_finanziari`, `tipo_cliente` già su `clienti`)
- Comportamento per cliente esistente: invariato (regola "non toccare clienti esistenti" già attiva)
- Validazione invio: se nessun gruppo selezionato, `tipoCliente` resta al default attuale ("privato"); valutiamo se rendere il gruppo obbligatorio. **Proposta**: NON obbligatorio per ora, per non rompere import/flussi esistenti — confermami se vuoi renderlo required.
