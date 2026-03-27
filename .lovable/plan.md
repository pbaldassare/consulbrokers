

## Piano: Importare Corrispondenti dall'Excel in anagrafiche_professionali

### Situazione attuale
- La tabella `anagrafiche_professionali` contiene ~267 record fake di tipo `corrispondente` (creati dal seed)
- L'Excel `Corrispondenti_1.xlsx` contiene ~267 corrispondenti reali con 20 colonne
- Tutti i campi dell'Excel mappano a colonne esistenti — nessuna migrazione DB necessaria

### Step 1 — Svuotare i corrispondenti fake

Eliminare tutti i record con `tipo = 'corrispondente'` dalla tabella `anagrafiche_professionali` (DELETE via insert tool). Prima verificare che non ci siano FK dipendenti (es. `codici_commerciali`, `sinistri`, `titoli` che referenziano questi record) e nullificarle se necessario.

### Step 2 — Importare i corrispondenti dall'Excel

Script Python che:
1. Legge l'Excel con pandas
2. Mappa le colonne:
   - `A=Ann` → `annullato` (true se "A", altrimenti false); se annullato → `attivo = false`
   - `Cod` → `codice`
   - `Descrizione` → `ragione_sociale`
   - `Azienda o Cognome` → `cognome`
   - `Segue o Nome` → `nome`
   - `Indirizzo` → `indirizzo`
   - `Località` → `citta`
   - `Prov` → `provincia`
   - `Cap` → `cap`
   - `%Base` → `percentuale_base`
   - `Cd For` → `codice_fornitore`
   - `%Ra` → `percentuale_ra`
   - `Tel` → `telefono`, `Fax` → `fax`, `Mail` → `email`
   - `Rui` → `numero_rui`
   - `Abi` → `abi`, `Cab` → `cab`, `Iban` → `iban`
   - `IntestatarioCC` → `intestatario_cc`
3. Imposta `tipo = 'corrispondente'` per tutti
4. Inserisce nel DB via psql/edge function

### Step 3 — Verificare i conteggi

Controllare che il numero di record inseriti corrisponda alle righe dell'Excel e che il tab "Corrispondenti" in Anagrafiche Professionali mostri i dati corretti.

### Dettagli tecnici
- Nessuna migrazione DB necessaria
- Import via edge function `import-compagnie` (riutilizzata/adattata) o script Python diretto con psql
- I valori vuoti saranno trattati come null
- Il campo `attivo` sarà `false` se `A=Ann` contiene "A", altrimenti `true`

