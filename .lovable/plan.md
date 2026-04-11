

## Piano: Allineare il form "Nuovo Prospect" al form "Nuovo Cliente"

### Problema
Il form di creazione prospect ha solo 6 campi (nome, cognome, email, telefono, fonte, note), ma un prospect e' un potenziale cliente che puo' essere privato, azienda o ente. Deve avere la stessa struttura del form di creazione cliente.

### Modifiche

#### 1. Migrazione database — Aggiungere colonne alla tabella `prospect`
Aggiungere alla tabella `prospect` tutti i campi presenti nella tabella `clienti` che mancano:

- `tipo_cliente` (text, default 'privato') — privato/azienda/ente
- Dati privato: `codice_fiscale`, `data_nascita`, `luogo_nascita`, `indirizzo_residenza`, `cap_residenza`, `citta_residenza`, `provincia_residenza`
- Dati azienda/ente: `ragione_sociale`, `partita_iva`, `codice_fiscale_azienda`, `codice_sdi`, `forma_giuridica`, `indirizzo_sede`, `cap_sede`, `citta_sede`, `provincia_sede`, `referente_nome`, `referente_cognome`, `referente_telefono`, `referente_email`
- Contatti aggiuntivi: `pec`, `cellulare`, `fax`
- Indirizzi alternativi: `indirizzo_alternativo`, `cap_alternativo`, `citta_alternativa`, `provincia_alternativa`, `indirizzo_fiscale`, `cap_fiscale`, `citta_fiscale`, `provincia_fiscale`
- Dati gestionali: `codice_ricerca`, `titolo`, `sesso`, `comune_nascita`, `provincia_nascita`, `nazione`, `attenzione_di`
- Dati statistici: `zona`, `indotto`, `attivita`, `settore`, `contratto`, `gruppo_finanziario_id`, `gruppo_statistico`, `fascia_fatturato`, `fascia_dipendenti`, `azienda_stat`, `matricola`, `riferimento`, `codice_ateco`, `cliente_associato`, `cliente_captive`, `internazionale`

#### 2. `src/pages/ProspectList.tsx` — Riscrivere il form di creazione
- Aggiungere selettore tipo prospect (privato/azienda/ente)
- Mostrare campi condizionali come nel form cliente:
  - Privato: nome, cognome, CF, data nascita, indirizzo residenza
  - Azienda/Ente: ragione sociale, P.IVA, CF azienda, SDI, forma giuridica, indirizzo sede, referente
- Contatti: email, telefono, PEC, cellulare
- Sezioni accordion: Dati Gestionali, Dati Statistici, Indirizzi Aggiuntivi
- Scanner AI documenti (carta identita/visura camerale)
- Auto-compilazione da Codice Fiscale (parseCF)
- Ingrandire il dialog a `max-w-3xl`

#### 3. Aggiornamento types Supabase
Rigenerare/aggiornare i tipi per includere le nuove colonne prospect.

### File coinvolti

| File | Azione |
|------|--------|
| Nuova migrazione SQL | ALTER TABLE prospect ADD COLUMN per ~35 nuovi campi |
| `src/pages/ProspectList.tsx` | Riscrittura completa del form di creazione |
| `src/integrations/supabase/types.ts` | Aggiornamento tipi per tabella prospect |

