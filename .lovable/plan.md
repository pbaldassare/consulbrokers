

## Piano: Importare Compagnie e Gruppi Compagnia dall'Excel e creare relazione FK

### Situazione attuale
- `gruppi_compagnia` ha solo `codice`, `descrizione`, `attivo` — nessuna FK da `compagnie`
- `compagnie.gruppo_compagnia` e` un campo **testo libero**, non collegato a `gruppi_compagnia`
- L'Excel contiene ~1374 compagnie con 23 colonne, tutte già mappabili ai campi esistenti
- Tutti i campi dell'Excel esistono già nel DB, non servono nuove colonne per i dati compagnia

### Step 1 — Migrazione DB: aggiungere FK `gruppo_compagnia_id`

Aggiungere colonna `gruppo_compagnia_id uuid REFERENCES gruppi_compagnia(id)` alla tabella `compagnie`. Il vecchio campo testo `gruppo_compagnia` resta per ora (potrà essere rimosso dopo la migrazione dati).

```sql
ALTER TABLE compagnie 
  ADD COLUMN gruppo_compagnia_id uuid REFERENCES gruppi_compagnia(id);
```

### Step 2 — Svuotare dati fake

Via insert tool (DELETE):
1. Nullificare `compagnia_id` in tabelle dipendenti (`prodotti`, `sinistri`, `flussi_compagnia`, `anagrafiche_professionali`, `document_folders`, `dettaglio_riparto`, ecc.) per evitare errori FK
2. DELETE da `compagnie` (tutti i record fake)
3. DELETE da `gruppi_compagnia` (tutti i record fake)

### Step 3 — Popolare `gruppi_compagnia` dall'Excel

Estrarre i valori distinti di `GruppoCompagnia` dall'Excel (~50-70 gruppi distinti come "Allianz Assicurazioni", "Generali Italia S.p.a.", "Plurimandatario", "METLIFE", ecc.) e inserirli nella tabella `gruppi_compagnia` con codice auto-generato.

### Step 4 — Importare le ~1374 compagnie dall'Excel

Leggere l'Excel con uno script Python, mappare ogni riga ai campi della tabella `compagnie`, risolvere il `gruppo_compagnia_id` dal nome del gruppo, e inserire via SQL/insert tool.

Mappatura colonne Excel → DB:
- `Codice` → `codice`, `Nome` → `nome`, `Nome_segue` → `nome_segue`
- `Indirizzo` → `indirizzo`, `Cap` → `cap`, `Comune` → `comune`, `Prov` → `provincia`
- `Tel` → `telefono`, `Fax` → `fax`, `CF` → `codice_fiscale`, `PIva` → `partita_iva`
- `Stato` → `stato`, `UltScadPol` → `ultima_scadenza_polizza`
- `GruppoCompagnia` → lookup su `gruppi_compagnia` → `gruppo_compagnia_id` (e anche campo testo `gruppo_compagnia`)
- `TipoMandatario` → `tipo_mandatario`, `GruppoStatistico` → `gruppo_statistico`
- `Mail` → `mail`, `Pec` → `pec`, `MailEC` → `mail_ec`, `MailAvvisi` → `mail_avvisi`
- `%RA` → `percentuale_ra`, `IBAN` → `iban`, `IntestatoA` → `intestato_a`

### Step 5 — Aggiornare frontend `CompagnieList.tsx`

- Cambiare il campo `gruppo_compagnia` (testo) per usare un **SearchableSelect** che carica da `gruppi_compagnia` via query
- Salvare `gruppo_compagnia_id` (uuid) invece del testo
- Mostrare il nome del gruppo tramite join nella query di lista

### Step 6 — Aggiornare frontend `TabelleBasePage.tsx`

Nessuna modifica necessaria: il tab `Gruppi Compagnia` usa già `SimpleLookupTab` generico.

### Dettagli tecnici
- Lo script di import verrà eseguito come script Python con `pandas` + `psql`
- I gruppi compagnia vuoti nell'Excel verranno trattati come `null`
- Le date `UltScadPol` verranno parsate dal formato Excel
- Il campo testo `gruppo_compagnia` verrà mantenuto per compatibilità ma popolato dal nome del gruppo

