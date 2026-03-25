

## Piano: Documenti utente + Provvigioni nel profilo

### Cosa cambia

1. **Nuove colonne su `profiles`**: Aggiungere `percentuale_base` (numeric) e `percentuale_consulenza` (numeric) per gestire le provvigioni di produzione e intermediazione direttamente nel profilo utente.

2. **Tabella `documenti_utenti`**: Nuova tabella per archiviare documenti associati agli utenti (carta d'identita, mandati, visure, etc.) con campi: `id`, `user_id`, `nome_file`, `path_storage`, `categoria` (carta_identita, mandato, visura, patente, altro), `note`, `created_at`.

3. **Storage bucket `documenti_utenti`**: Nuovo bucket privato per i file caricati.

4. **Nuovo tab "Provvigioni"** nel dialog di modifica utente: Due campi numerici per percentuale base (produzione) e percentuale consulenza (intermediazione).

5. **Nuovo tab "Documenti"** nel dialog di modifica utente: Lista documenti caricati per l'utente, upload di nuovi documenti con selezione categoria, possibilita di eliminare/scaricare.

6. **Aggiornamento `handleEdit`**: Salvare anche `percentuale_base` e `percentuale_consulenza` nel profilo.

### Modifiche per file

| File | Modifica |
|------|----------|
| **Migration SQL** | `ALTER TABLE profiles ADD COLUMN percentuale_base numeric(5,2), ADD COLUMN percentuale_consulenza numeric(5,2)`. Creare tabella `documenti_utenti`. Creare bucket `documenti_utenti`. RLS policies per documenti_utenti e bucket |
| **GestioneUtenti.tsx** | Aggiungere tab "Provvigioni" con i due campi percentuale. Aggiungere tab "Documenti" con upload, lista e download. Aggiornare `UserProfile` interface, `fetchUsers` select, `handleEdit` update. Da 4 a 6 tabs nel dialog |

### Dettagli tecnici

- Categorie documenti: `carta_identita`, `mandato`, `visura`, `patente`, `altro`
- Il tab Provvigioni mostra due Input numerici con step 0.01 e suffisso "%"
- Il tab Documenti carica nel bucket `documenti_utenti` con path `{user_id}/{timestamp}_{filename}`
- I documenti vengono salvati nella tabella `documenti_utenti` e listati nel tab con possibilita di download e cancellazione

