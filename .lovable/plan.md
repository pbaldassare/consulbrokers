

## Import diretto del file storico gare nel database

### Cosa faccio (operazione una-tantum, nessuna modifica al codice)

1. **Copio il file** `user-uploads://ELENCO_GARE_GENERALE_1-2.xlsx` in `/tmp/elenco_gare.xlsx` sul sandbox.
2. **Pre-flight check**: leggo il file con `pandas` per stampare:
   - elenco fogli e numero righe per foglio,
   - anteprima header del primo foglio per confermare che le colonne (`ENTE`, `PROV`, `BROKER`, `INIZIO MANDATO`, `FINE MANDATO`, `NOTE`, ecc.) corrispondano a quanto si aspetta l'edge function.
3. **Pulisco eventuali import precedenti**: eseguo `DELETE FROM storico_gare` via migrazione SQL idempotente prima di caricare (così rilanciare il job non duplica record).
4. **Invoco l'edge function `import-storico-gare`** già deployata, via `curl` con:
   - URL: `https://zbjmnnlojxprlogbnxef.supabase.co/functions/v1/import-storico-gare`
   - header `Authorization: Bearer <SERVICE_ROLE_KEY>` letto da env del sandbox (lo script bypassa il check ruolo perché non c'è user JWT — modifico **temporaneamente** il check così: se l'header è il service role, salta la verifica `profiles.ruolo`).
   - body JSON: `{ fileBase64: "<b64>", fileName: "ELENCO_GARE_GENERALE_1-2.xlsx", replace: true }`.
5. **Fallback**: se preferisci non toccare l'edge function, eseguo lo stesso parsing **direttamente in Python** sul sandbox (replica della logica TypeScript: stesso parseDate, parseFlag, deriveEsito, isRiepilogo, regole foglio→anno) e inserisco le righe via `psql`/REST con la service role. In entrambi i casi i trigger DB già fanno il resto (`broker_incumbent` normalizzato, `categoria_ente` derivato, `opzione_rinnovo_anni` estratto).
6. **Report finale**: ti restituisco in chat i conteggi:
   - righe inserite totali,
   - per anno (es. 2014: 87, 2015: 102, …),
   - per `esito` (vinta/persa/non_partecipato/null),
   - per `categoria_ente` (comune/provincia/asl/…),
   - clienti auto-linkati (match `ente_nome` → `clienti.ragione_sociale`),
   - eventuali parse-errors su date.

### Modifica minima all'edge function (per consentire run via service role)

In `supabase/functions/import-storico-gare/index.ts` aggiungo all'inizio del controllo auth:

```ts
const isServiceRole = authHeader === `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`;
if (!isServiceRole) {
  // ... check user JWT + ruolo come oggi
}
```

Così resta sicura per gli utenti UI (solo admin/responsabile_sede) e permette l'import operativo da sandbox.

### Cosa NON tocco

- Schema `storico_gare`, vista `v_storico_gare`, trigger `storico_gare_normalize` → già a posto.
- Pagina `/trattative/storico-gare` → già funziona, leggerà i dati appena caricati.
- `schema-context.ts` AI → già aggiornato.

### Verifica

1. Apri `/trattative/storico-gare` dopo l'import: vedi la lista paginata con (atteso) ~600-1000 record.
2. Filtri "anno=2017, esito=vinta" → conteggio coerente con quanto riepilogato nel foglio originale.
3. Chiedi all'AI Assistant: *"quanti comuni del Veneto in storico gare con broker Intermedia"* → ti risponde con un numero non zero.
4. Ti riporto in chat il dettaglio numerico per anno e per esito, così confronti con i totali del file.

