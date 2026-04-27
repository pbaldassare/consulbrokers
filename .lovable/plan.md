## Aggregazione Compagnie con Nomi Simili

### Situazione attuale
- **1.374 record** in `compagnie` ma solo **761 nomi univoci** (dopo normalizzazione spazi/maiuscole)
- Esempio: 30 record per "GENERALI ITALIA SPA (DIV. INA/ASS.)", 26 per "SOCIETA' REALE MUTUA DI ASS.NI", 22 per "UNIPOLSAI ASS.NI SPA (DIV. AURORA)", ecc.
- Le 1.374 compagnie hanno **830 titoli** e **5 sinistri** collegati che vanno preservati

### Obiettivo
Ridurre i duplicati mantenendo **un solo record "master"** per ogni nome compagnia (normalizzato), e **rimappando tutti i collegamenti** (titoli, sinistri, prodotti, flussi, ecc.) sul master.

### Strategia di matching
Considero "duplicati" i record con **stesso nome dopo normalizzazione**:
- Trim degli spazi
- Spazi multipli → spazio singolo
- UPPER case
- Rimozione asterisco iniziale (`*GENERALI ITALIA SPA` = `GENERALI ITALIA SPA`)

**NON aggrego** nomi diversi anche se dello stesso gruppo (es. "GENERALI ITALIA SPA (DIV. INA/ASS.)" resta separato da "GENERALI ITALIA SPA" — sono divisioni diverse). L'aggregazione cross-divisione è già garantita dal `gruppo_compagnia_id`.

### Approccio in 3 step

**Step 1 — Report di anteprima (PDF)**
Genero `/mnt/documents/duplicati_compagnie_aggregazione.pdf` con:
- Lista cluster (nome master + codici duplicati + nº titoli/sinistri collegati per record)
- Master scelto = record con più titoli collegati (in caso di parità: codice alfabeticamente primo)
- Totale record da eliminare

**Step 2 — Tu approvi il PDF**
Confermi se i cluster sono corretti, oppure mi indichi eccezioni da escludere.

**Step 3 — Migrazione DB (dopo OK)**
Migrazione SQL transazionale che:
1. Per ogni cluster, identifica master_id
2. UPDATE su tutte le tabelle dipendenti: `titoli`, `sinistri`, `prodotti`, `flussi_compagnia`, `provvigioni_compagnia_ramo`, `rimessa_premi`, `dettaglio_riparto`, `document_folders`, `anagrafiche_professionali` → sostituisce `compagnia_id` duplicato con master_id
3. DELETE dei record duplicati da `compagnie`
4. Risultato atteso: ~613 record eliminati, da 1.374 → ~761 compagnie

### Sicurezza
- ❌ Nessun dato perso: tutti i collegamenti vengono ri-mappati prima del DELETE
- ❌ Nessuna modifica UI in questo step
- ✅ Migrazione reversibile via backup pre-esecuzione (snapshot tabella `compagnie` salvato in `compagnie_backup_pre_dedup`)

### Cosa ti consegno ora
Solo il **PDF di anteprima** con i cluster proposti. La migrazione effettiva parte solo dopo tuo OK esplicito.
