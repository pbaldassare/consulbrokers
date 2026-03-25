

## Piano: Espansione Anagrafica Clienti + Gruppi Finanziari + Rete Commerciale

### Panoramica

Basandomi sugli screenshot del gestionale legacy, devo aggiungere alla tabella `clienti` molti campi mancanti, creare una tabella lookup `gruppi_finanziari` gestibile dall'admin, e implementare la gestione della rete commerciale (Account Executive + Corrispondenti con % provvigione) per ogni cliente.

### 1. Nuove colonne sulla tabella `clienti`

Campi da aggiungere (tutti nullable):

**Dati Anagrafici extra**: `codice_ricerca`, `titolo` (Sig/Dott/etc), `stato_cliente` (attivo/sospeso/non_operativo), `prospect` (si/ex/na), `cellulare`, `fax`, `nazione`, `attenzione_di`

**Dati Gestionali**: `tipo_persona` (fisica/giuridica/na), `sesso` (M/F/na), `comune_nascita`, `provincia_nascita`, `tipo_sommario` (A/B/C/D/E), `cliente_non_ceduto` (boolean), `azienda_ssn_sx` (boolean), `spec_sx_danni`, `spec_sx_sanita`, `statistica_premi_sinistri` (boolean)

**Dati Statistici**: `zona`, `indotto`, `gruppo_finanziario_id` (FK), `attivita`, `gruppo_statistico`, `settore`, `azienda_stat`, `contratto`, `matricola`, `riferimento`, `fatturato`, `num_dipendenti`, `codice_ateco`, `cliente_associato` (boolean), `cliente_captive` (boolean), `internazionale` (boolean)

**Dati Contabili**: `fido_credito`, `fido_cauzioni`

### 2. Tabella `gruppi_finanziari` (lookup gestibile)

Nuova tabella con campi `id`, `codice`, `descrizione`, `attivo`. CRUD completo integrato in Tabelle Base, accessibile anche dall'admin.

### 3. Tabella `codici_commerciali_cliente` (rete commerciale)

Gestisce le assegnazioni commerciali per ogni cliente:
- `id`, `cliente_id` (FK), `ruolo` (account_executive/corrispondente_1/corrispondente_2/corrispondente_3)
- `profilo_id` (FK a profiles — l'utente commerciale)
- `percentuale` (numeric — la % di provvigione)
- `societa_brand`, `filiale`, `mandato`, `contatto`
- Date: `data_acquisito`, `scadenza_mandato`, `data_disdetta`, `termine_proroga`
- `altro_broker` (boolean), `altro_broker_nome`

Questo permette di calcolare la ripartizione provvigionale della rete.

### 4. Aggiornamento UI

**ClienteDetail.tsx**: Aggiungere sezioni collassabili (Accordion) per:
- Dati Gestionali
- Dati Statistici (con select per Gruppo Finanziario)
- Codici Commerciali (con sub-form per AE + 3 Corrispondenti, ciascuno con select profilo + % provvigione)
- Dati Contabili
- Documenti (Allegato 3, Privacy, Invio Contrattuale)

**ClientiList.tsx**: Aggiungere i nuovi campi al form di creazione.

**TabelleBasePage.tsx**: Aggiungere tab "Gruppi Finanziari".

### 5. Logica ripartizione provvigionale

Quando un titolo viene incassato, il sistema potra leggere i `codici_commerciali_cliente` del cliente associato e calcolare la quota di provvigione per ogni membro della rete (AE + Corrispondenti) in base alle loro percentuali.

### Modifiche per file

| File | Modifica |
|------|----------|
| **Migration SQL** | ALTER TABLE clienti (20+ colonne). CREATE TABLE gruppi_finanziari. CREATE TABLE codici_commerciali_cliente. RLS policies |
| **ClienteDetail.tsx** | Accordion con sezioni Gestionali, Statistici, Commerciali, Contabili. Form inline per codici commerciali con select profili + % |
| **ClientiList.tsx** | Aggiungere campi extra al form di creazione (stato, prospect, cellulare, fax, etc.) |
| **TabelleBasePage.tsx** | Nuovo tab "Gruppi Finanziari" usando il componente SimpleLookupTab esistente |

### Dettagli tecnici

- La tabella `codici_commerciali_cliente` ha un vincolo UNIQUE su `(cliente_id, ruolo)` per evitare duplicati
- Le percentuali sono `numeric(5,2)` per supportare valori come 12.50%
- Il campo `profilo_id` referenzia `profiles(id)` — si filtra per ruoli commerciali (produttore, ufficio, backoffice)
- La ripartizione provvigionale si calcola come: `premio * percentuale_membro / 100` per ogni membro della rete

