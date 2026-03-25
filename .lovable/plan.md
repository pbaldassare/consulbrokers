

## Piano: Refactoring Gestione Utenti + Nuovi campi profilo + Seed 10 utenti

### Cosa cambia

1. **Filtrare via i clienti**: La query in `GestioneUtenti` escludera i profili con `ruolo = 'cliente'`.

2. **Nuove colonne sulla tabella `profiles`**: Aggiungere 16 campi mancanti:
   - `descrizione`, `indirizzo`, `cap`, `citta`, `provincia`, `telefono`, `fax`, `codice_fiscale`
   - `nome_rui`, `data_iscrizione_rui`, `numero_rui`, `sezione_rui`
   - `codice_contabile`, `percentuale_ra`, `iban`, `intestatario_cc`

3. **Dialog di modifica completo** con sezioni:
   - **Dati Generali**: Descrizione, Cognome/Denominazione, Nome, Ruolo, Stato (Attivo/Annullato)
   - **Recapiti**: Indirizzo, CAP/Comune/Prov, Email, Telefono, Fax
   - **Iscrizione RUI**: Nome Iscrizione, Data, Numero, Sezione
   - **Dati Fiscali/Bancari**: Codice Contabile, Codice Fiscale, % Rit. Acconto, IBAN, Intestato a

4. **Ufficio/Sede FACOLTATIVO**: Il collegamento a un ufficio sara disponibile ma mai obbligatorio per nessun ruolo. Nessuna validazione bloccante.

5. **Seed 10 utenti demo**: Edge Function che crea 10 utenti con tutti i campi compilati.

### Modifiche per file

| File | Modifica |
|------|----------|
| **Migration SQL** | `ALTER TABLE profiles ADD COLUMN` per i 16 nuovi campi (tutti nullable) |
| **GestioneUtenti.tsx** | Filtrare `.neq('ruolo', 'cliente')`. Ricostruire dialog modifica con form completo a sezioni. Rimuovere `'cliente'` dall'array ROLES. Ufficio opzionale (no validazione obbligatoria) |
| **create-user/index.ts** | Accettare e salvare i nuovi campi nel profilo |
| **seed-demo-users/index.ts** | Nuova Edge Function per creare 10 utenti demo con dati realistici |

