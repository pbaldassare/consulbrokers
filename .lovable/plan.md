

## Piano: Creare tabella Clienti dedicata con supporto Privato/Azienda

### Situazione attuale

La tabella `profiles` è usata per gli utenti di sistema (admin, ufficio, produttore, etc.) e attualmente anche per i clienti (`ruolo = 'cliente'`). Ha solo campi base: nome, cognome, email. Serve una tabella `clienti` dedicata con tutti i campi anagrafici necessari per privati e aziende.

### Database: Nuova tabella `clienti`

Creare la tabella con un campo `tipo_cliente` (`privato` | `azienda`) e tutti i campi per entrambi i tipi:

**Campi comuni:**
- `id`, `tipo_cliente`, `email`, `telefono`, `pec`, `ufficio_id`, `attivo`, `note`, `created_at`, `updated_at`

**Campi Privato:**
- `nome`, `cognome`, `codice_fiscale`, `data_nascita`, `luogo_nascita`
- `indirizzo_residenza`, `cap_residenza`, `citta_residenza`, `provincia_residenza`

**Campi Azienda:**
- `ragione_sociale`, `partita_iva`, `codice_fiscale_azienda`, `codice_sdi`, `forma_giuridica`
- `indirizzo_sede`, `cap_sede`, `citta_sede`, `provincia_sede`
- `referente_nome`, `referente_cognome`, `referente_telefono`, `referente_email`

RLS policies: stesse logiche delle altre tabelle (admin all, cfo select, ufficio own).

### Frontend: Riscrivere `ClientiList.tsx`

1. **Tab Privati / Aziende** in alto per filtrare per tipo
2. **Tabella** con colonne diverse per tipo (CF/Nome/Cognome vs P.IVA/Ragione Sociale)
3. **Dialog "Nuovo Cliente"** con selector Privato/Azienda che mostra i campi appropriati
4. **Barra di ricerca** per filtrare per nome/ragione sociale/CF/P.IVA
5. **Switch attivo/disattivo** come nelle Compagnie

### File coinvolti
- **Migrazione DB**: nuova tabella `clienti` con RLS
- **Modificato**: `src/pages/ClientiList.tsx` (riscrittura completa)
- **Modificato**: `src/App.tsx` (rotta invariata `/archivi/clienti`)

