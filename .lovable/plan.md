# Fix: banner "Gruppo Finanziario mancante" su cliente che ce l'ha

## Causa reale
Il cliente Agnone in DB ha tutto correttamente impostato:
- `tipo_cliente = 'ente'`
- `gruppo_finanziario_id` → `AZ_PART_PUB · Azienda Partecipata Pubblica` (`tipo_soggetto = 'ente'`)

Però la query frontend usa l'embed PostgREST:
```ts
.select("..., gruppi_finanziari(id, codice, nome, tipo_soggetto)")
```
e sulla tabella `public.gruppi_finanziari` **non esistono GRANT** per nessun ruolo (`anon`, `authenticated`, `service_role`). Le policy RLS dicono "Authenticated can read = true", ma senza GRANT a livello di tabella PostgREST rifiuta comunque l'accesso → l'embed restituisce `null`.

Risultato:
- Il badge sotto al cliente mostra "⚠ Gruppo finanziario mancante"
- `tipoSoggetto` resta `null` (anche il fallback su `tipo_cliente` non basta perché in alcuni branch del codice si guarda direttamente `gruppi_finanziari`)
- `saveBlockReason` mostra il banner "non ha un Gruppo Finanziario"

## Intervento (1 migration, nessun codice toccato)
```sql
GRANT SELECT ON public.gruppi_finanziari TO authenticated;
GRANT ALL    ON public.gruppi_finanziari TO service_role;
```
(Non concedo `anon`: la tabella non è mai usata in contesti non autenticati.)

## Verifica post-migration
1. Riapertura di `/portafoglio/immissione?clienteId=…Agnone…`:
   - badge mostra "Ente · AZ_PART_PUB Azienda Partecipata Pubblica"
   - banner di blocco salvataggio sparisce
   - CIG/Rif. resta visibile con asterisco (Ente)
2. Nessuna modifica a regole CIG (10 caratteri / flag temporaneo) né a logiche di save.

## Note
Nessuna modifica a file applicativi: il bug è puramente di privilegi DB.
