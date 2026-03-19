

## Piano: Gestione Uffici e Collegati

### Situazione attuale
- La tabella `uffici` esiste nel DB con campi: `id`, `nome_ufficio`, `codice_ufficio`, `attivo`, `created_at`
- Non esiste nessuna pagina per gestire gli uffici
- Molte tabelle hanno `ufficio_id` come FK: `profiles`, `clienti`, `titoli`, `movimenti_contabili`, `sinistri`, `anagrafiche_professionali`, `note_restituzione`, ecc.
- La pagina Tabelle di Base gestisce lookup semplici (codice/descrizione) ma gli uffici hanno una struttura piu ricca

### Cosa creeremo

#### Pagina `GestioneUfficiPage` sotto Sistema
Pagina standalone accessibile da sidebar (sezione Sistema, solo admin) con:

**Vista principale — Lista Uffici**
- Tabella con: Codice, Nome Ufficio, N. Utenti, N. Clienti, Stato (attivo/disattivo), Azioni
- Bottone "Nuovo Ufficio"
- I conteggi utenti/clienti saranno calcolati con query aggregate su `profiles` e `clienti`

**Dialog Crea/Modifica Ufficio**
- Campi: Codice Ufficio, Nome Ufficio, Attivo (switch)

**Dettaglio Ufficio (espandibile o click)**
Al click su un ufficio, sezione dettaglio con tab:
- **Utenti collegati**: lista `profiles` con `ufficio_id` = ufficio selezionato (nome, cognome, ruolo, email)
- **Clienti collegati**: lista `clienti` con `ufficio_id` = ufficio selezionato (cognome, nome, tipo_cliente)
- **Anagrafiche Professionali**: lista `anagrafiche_professionali` con `ufficio_id` = ufficio selezionato (tipo, cognome, nome)
- **Impostazioni Ufficio**: link rapido alle impostazioni specifiche dell'ufficio

Ogni tab mostrera conteggio e tabella read-only (la riassegnazione si fa dalle rispettive pagine di gestione).

### File coinvolti

| Azione | File |
|--------|------|
| Creare | `src/pages/GestioneUfficiPage.tsx` |
| Modificare | `src/App.tsx` — aggiungere rotta `/gestione-uffici` |
| Modificare | `src/components/AppSidebar.tsx` — aggiungere link in sezione Sistema |

Nessuna migration necessaria — la tabella `uffici` e tutte le relazioni esistono gia.

