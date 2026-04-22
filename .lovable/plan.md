

## Import diretto dei dati Excel — senza secret, senza edge function

Hai ragione, niente secret. Faccio tutto dal sandbox via `psql` direttamente sul DB (accesso già disponibile).

### Cosa faccio

1. **Copio** `user-uploads://ELENCO_GARE_GENERALE_1-3.xlsx` in `/tmp/elenco_gare.xlsx`.
2. **Pulizia**: `TRUNCATE storico_gare` (la tabella è vuota o contiene tentativi precedenti — la azzero per non duplicare).
3. **Parsing in Python** (pandas + openpyxl): leggo tutti i fogli, applico la stessa logica della edge function:
   - skip righe vuote e righe di riepilogo (`TOT`, `PERCENTUALE`, `GARA VINTE`…),
   - parse date in formati misti (`dd/mm/yyyy`, `dd.mm.yyyy`, serial Excel, fallback null se non parsabile),
   - normalizzazione flag `SI`/`NO`/`X` → bool,
   - derivazione `esito` da NOTE (vinta/persa/annullata/non_partecipato/in_corso),
   - estrazione `anno_riferimento` dal nome del foglio (o, per fogli tipo "INTERMEDIA", dalla `data_inizio_mandato`),
   - `provincia` ridotta a 2 char uppercase.
4. **Generazione SQL** in batch da 200 righe → eseguo via `psql` con i `PG*` env vars già disponibili nel sandbox.
5. **I trigger DB fanno il resto in automatico**:
   - `broker_incumbent` normalizzato (B&S ITALIA, INTERMEDIA, AON, MARSH, WILLIS…),
   - `categoria_ente` derivato da regex sul nome (comune/provincia/asl/università…),
   - `opzione_rinnovo_anni` estratto da regex sul testo libero,
   - auto-link a `clienti` via `ente_nome` ILIKE.
6. **Report finale in chat**:
   - righe totali inserite,
   - breakdown per anno,
   - breakdown per esito,
   - breakdown per categoria_ente,
   - n. clienti auto-linkati,
   - n. errori di parsing date (righe inserite comunque, con date null + nota originale).

### Cosa NON tocco

- Codice della edge function (resta com'è, useremo psql diretto).
- Schema, vista, trigger, RLS di `storico_gare`.
- Pagina UI `/trattative/storico-gare`.

### Verifica finale

Dopo l'import apri `/trattative/storico-gare`: vedi la lista paginata con i dati reali e i 7 filtri categoriali popolati. Ti riporto qui i conteggi per confronto col file originale.

