

## Piano: Riparare la vista v_portafoglio_titoli

### Problema
La migrazione precedente ha ricreato la vista `v_portafoglio_titoli` perdendo tre colonne calcolate essenziali usate da tutte le pagine del portafoglio:
- `cliente_nome_display` (COALESCE di ragione_sociale / cognome+nome)
- `cliente_codice` (da `clienti.codice_ricerca`)
- `ramo_nome` (alias di `rami.descrizione`)

Questo causa il "Nessuna polizza trovata" perché le query PostgREST falliscono silenziosamente quando richiedono colonne inesistenti.

### Intervento

**Migrazione SQL** — ricreare la vista con le colonne mancanti ripristinate:

```sql
DROP VIEW IF EXISTS v_portafoglio_titoli;

CREATE VIEW v_portafoglio_titoli AS
SELECT
  t.*,
  c.nome AS compagnia_nome,
  c.codice AS compagnia_codice,
  r.descrizione AS ramo_nome,
  r.codice AS ramo_codice,
  COALESCE(cl.ragione_sociale, TRIM(COALESCE(cl.cognome,'') || ' ' || COALESCE(cl.nome,''))) AS cliente_nome_display,
  cl.codice_ricerca AS cliente_codice,
  cl.cognome AS cliente_cognome,
  cl.nome AS cliente_nome,
  cl.ragione_sociale AS cliente_ragione_sociale,
  cl.codice_fiscale AS cliente_codice_fiscale,
  cl.tipo_cliente AS cliente_tipo,
  u.nome_ufficio
FROM titoli t
LEFT JOIN compagnie c ON c.id = t.compagnia_id
LEFT JOIN rami r ON r.id = t.ramo_id
LEFT JOIN prodotti p ON p.id = t.prodotto_id
LEFT JOIN clienti cl ON cl.id = t.cliente_anagrafica_id
LEFT JOIN uffici u ON u.id = t.ufficio_id;
```

**Nessuna modifica al codice** — le pagine PortafoglioAttive, Carico e Storico usano già i nomi corretti.

### File coinvolto
- Una sola migrazione SQL

