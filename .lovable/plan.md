

## Piano: Importare Account Executive dall'Excel come `responsabile_sede`

### Dati Excel
Il file `AccountExecutive-2.xlsx` contiene ~180 righe con 13 colonne. La maggior parte ha solo Codice, Descrizione e eventualmente A=Ann. Alcuni hanno dati bancari, RUI, telefono, mail e sigla.

### Mappatura colonne

| Excel | DB (`anagrafiche_professionali`) |
|-------|----------------------------------|
| `Codice` | `codice` |
| `Descrizione` | `ragione_sociale` |
| `Telefono` | `telefono` |
| `Mail` | `email` |
| `Sigla` | `sigla` |
| `Banca (1 riga)` | `banca_riga1` |
| `Banca (2 riga)` | `banca_riga2` |
| `Banca (3 riga)` | `banca_riga3` |
| `Nome Rui` | `nome_rui` |
| `Iscr Rui` | `iscrizione_rui` |
| `Numero Rui` | `numero_rui` |
| `Sez. Rui` | `sezione_rui` |
| `A=Ann` | `annullato` (true se "A") → `attivo = false` |

Tutti i campi esistono gia nel DB. **Nessuna migrazione necessaria.**

### Step 1 — Svuotare i fake `responsabile_sede`

- Nullificare eventuali FK in `codici_commerciali_cliente.profilo_id` che puntano a record `tipo = 'responsabile_sede'`
- DELETE da `anagrafiche_professionali` WHERE `tipo = 'responsabile_sede'`

### Step 2 — Importare dall'Excel

- Script Python che legge l'Excel con pandas
- Mappa le colonne come sopra, imposta `tipo = 'responsabile_sede'` per tutti
- Valori vuoti → null
- `A=Ann = "A"` → `annullato = true`, `attivo = false`; altrimenti `annullato = false`, `attivo = true`
- Invio dati via edge function (riutilizzando lo stesso pattern di `import-corrispondenti`, adattato per il tipo `responsabile_sede`)

### Step 3 — Verificare conteggi

Controllare che i record inseriti corrispondano alle righe dell'Excel.

### Dettagli tecnici
- Edge function: creare `import-responsabili-sede` (o riutilizzare `import-corrispondenti` generalizzandola con un parametro `tipo`)
- Batch insert da 50
- Nessuna migrazione DB

