

## Piano: Importare quietanzamento Excel e correggere le pagine Portafoglio

### 1. Creare una vista database per il portafoglio

Le pagine attualmente cercano colonne inesistenti (`numero_polizza`, `compagnia_nome`, `cliente_cognome`). Serve una **vista** `v_portafoglio_titoli` che unisce `titoli`, `clienti`, `compagnie` e `rami`:

```sql
CREATE VIEW v_portafoglio_titoli AS
SELECT 
  t.id, t.numero_titolo, t.stato, t.premio_lordo,
  t.garanzia_da, t.garanzia_a, t.data_scadenza,
  t.compagnia_id, t.ramo_id, t.ufficio_id,
  t.ae_nome, t.specialist, t.produttore_nome,
  t.provvigioni_firma, t.provvigioni_quietanza, t.filiale,
  t.targa_telaio, t.rate,
  c.nome AS compagnia_nome,
  r.descrizione AS ramo_nome,
  COALESCE(cli.ragione_sociale, cli.cognome || ' ' || cli.nome) AS cliente_nome_display,
  cli.codice_ricerca AS cliente_codice
FROM titoli t
LEFT JOIN compagnie c ON c.id = t.compagnia_id
LEFT JOIN rami r ON r.id = t.ramo_id
LEFT JOIN clienti cli ON cli.id = t.cliente_anagrafica_id;
```

### 2. Importare i dati mancanti dall'Excel

Tramite script exec:
- Parsare le 16 righe dell'Excel di quietanzamento
- Confrontare ogni `Polizza` con `titoli.numero_titolo`
- **3 polizze mancanti** (`332437571`, `332437574`, `AXKY13OP`): inserirle come nuovi titoli
- **1 premio errato** (`9479008.`): aggiornare da -62.50 a 16.022,50
- **13 polizze già presenti**: aggiornare i campi provvigioni attive/passive, targa, specialist, produttore se diversi

### 3. Riscrivere PortafoglioCaricoPage

- Query sulla vista `v_portafoglio_titoli` filtrando su `data_scadenza` nel mese selezionato
- Colonne: Polizza, Cliente, Compagnia, Ramo, Scadenza, Fraz, Lordo, Attive, Passive, AE, Specialist, Produttore
- Filtri: ricerca testo, compagnia, ramo
- Card riepilogativa con totale polizze e totale premio lordo del mese

### 4. Riscrivere PortafoglioAttivePage

- Stessa vista, filtrando `stato = 'attivo' AND garanzia_a >= oggi`
- Stesse colonne e filtri

### File coinvolti

| File | Azione |
|------|--------|
| Migrazione SQL | Creare vista `v_portafoglio_titoli` con RLS |
| `src/pages/PortafoglioCaricoPage.tsx` | Riscrivere query su vista, colonne corrette |
| `src/pages/PortafoglioAttivePage.tsx` | Riscrivere query su vista, colonne corrette |
| Script exec | Importare 3 polizze mancanti + aggiornare premio 9479008 |

