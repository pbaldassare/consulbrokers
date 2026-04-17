

## Analisi sezione "Contratto"

Attualmente la card **Contratto** (`TitoloDetail.tsx` righe 757-792) è **read-only**. Mostra 17 campi misti: alcuni vengono dalle anagrafiche (Compagnia, Ramo, Prodotto, Cliente, Produttore, Ufficio) e altri sono attributi propri della polizza.

### Classificazione dei campi

**🔒 Read-only (immutabili — vincoli storici/integrità)**
- **Numero Polizza** (`numero_titolo`) — chiave commerciale, mai modificabile
- **Riga** (`riga`) — discriminator dei movimenti polizza
- **Appendice** (`appendice`) — generata dal modulo Appendici
- **Compagnia** (`compagnia_id`) — non si cambia compagnia di un titolo emesso (si annulla e si re-immette)
- **Ramo** (`ramo_id`) — stessa logica
- **Cliente** (`cliente_anagrafica_id`) — non si "trasferisce" un titolo a un altro cliente
- **Attività / Gr. Finanziario / Gr. Statistico** — derivati dall'anagrafica cliente (modificabili lì, non qui)

**✏️ Editabili a mano (testo libero)**
- **Tipo Portafoglio** — select da valori legacy (es. "POLIZZE FAMIGLIA FIORE", "VITA", ecc.) → SearchableSelect
- **CIG/Rif.** — testo libero (riferimento gara)
- **Vincolo** — testo libero (es. banca/finanziaria)
- **Targa/Telaio** — testo (per RCA; auto-popolato dalla sezione Veicolo)
- **Descrizione** (`descrizione_polizza`) — textarea
- **Prodotto** (`prodotto_id`) — SearchableSelect filtrato per compagnia (cambia il "pacchetto" all'interno della stessa compagnia)
- **Specialist** (`specialist`) — SearchableSelect su utenti con ruolo backoffice
- **Produttore** (`produttore_id`) — SearchableSelect su produttori della sede
- **Ufficio** (`ufficio_id`) — SearchableSelect su `uffici` (raro ma possibile trasferimento sede)

### Pattern UI proposto

Replicare il pattern già usato per **Regolazione** (riga 813-880):
- Pulsante **"Modifica"** in alto a destra della card
- In modalità edit: i campi editabili diventano `Input`/`SearchableSelect`/`Textarea`; quelli read-only restano testo grigio con icona 🔒
- Pulsanti **"Annulla" / "Salva"** in fondo
- Mutation `useMutation` che fa `UPDATE titoli SET ... WHERE id = ?` e logga in timeline (`logAttivita`) il diff dei campi modificati
- Invalidazione `queryClient.invalidateQueries(['titolo', id])`

### File toccato
- `src/pages/TitoloDetail.tsx` — sezione "Contratto" (righe 757-792) + nuovo state `editingContratto` + `contrattoForm` + `saveContrattoMutation`

### Lookup necessari
- `tipoPortafoglioOpts` — valori distinti da `titoli.tipo_portafoglio` (query `SELECT DISTINCT`)
- `prodottiOpts` — `SELECT id, nome_prodotto FROM prodotti WHERE compagnia_id = t.compagnia_id`
- `produttoriOpts` — utenti livello produttore della sede del titolo
- `ufficiOpts` — `SELECT id, nome_ufficio FROM uffici`
- `specialistOpts` — utenti con ruolo backoffice

### Cosa NON cambia
- Le altre sezioni (Periodo, Regolazione, Importi, Veicolo, ecc.) restano per i prossimi step.
- Permessi: l'edit è disponibile solo per ruoli con scrittura su `titoli` (RLS già attiva).
- Logging: ogni salvataggio scrive in `attivita` con dettaglio campi modificati.

### Domanda di conferma
Procedo con il pattern descritto? Subito dopo l'approvazione passerò ad analizzare in dettaglio **Periodo** (datepicker per le date, validazioni di coerenza tra `durata_da/a`, `garanzia_da/a`, `data_scadenza`).

