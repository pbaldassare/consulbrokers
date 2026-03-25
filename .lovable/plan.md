

## Piano: Armonizzazione Anagrafica Cliente + Dati Fake

### Cosa cambia

1. **Migration SQL per popolare dati fake** sui 480 clienti esistenti — riempire i campi vuoti con valori realistici:
   - **Privati (330)**: `titolo` (Sig/Dott/etc), `sesso` (M/F basato sul nome), `tipo_persona` = "fisica", `cellulare`, `nazione` = "Italia", `zona` (Nord/Centro/Sud), `stato_cliente` = "attivo", `prospect` random, `codice_ricerca` = prime lettere cognome+nome, `comune_nascita`, `provincia_nascita`, `codice_ateco` random, `settore`, `attivita`
   - **Aziende (150)**: `tipo_persona` = "giuridica", `sesso` = "na", `fax`, `nazione` = "Italia", `zona`, `settore`, `codice_ateco`, `fatturato`, `num_dipendenti`, `fido_credito`
   - **Gruppo Finanziario**: assegnare casualmente uno degli 8 gruppi a ~30% dei clienti (quelli con rapporti bancari/assicurativi)

2. **Armonizzare la UI di ClienteDetail.tsx**:
   - Tutti i `FieldSelect` diventano `SearchableSelect` (con ricerca): Titolo, Stato, Prospect, Tipo Persona, Sesso, Tipo Sommario
   - Il Gruppo Finanziario è già SearchableSelect, verificare funzionamento
   - Layout uniforme: stessa altezza input (h-8), stesse label (text-xs), grid consistente
   - In read-only mode: visualizzazione pulita e coerente con dash "—" per campi vuoti

3. **Aggiungere SearchableSelect al FieldSelect helper** — creare un nuovo helper `FieldSearchable` che usa SearchableSelect in edit mode e testo in read-only mode, per uniformare tutti i dropdown

### Modifiche per file

| File | Modifica |
|------|----------|
| **Migration SQL** | UPDATE clienti con dati fake randomizzati (titolo, sesso, cellulare, zona, nazione, codice_ricerca, settore, gruppo_finanziario_id, etc.) |
| **ClienteDetail.tsx** | Sostituire `FieldSelect` con nuovo `FieldSearchable` che usa `SearchableSelect`. Armonizzare grid e spacing |

### Dettagli tecnici

- La migration usa `random()` e `CASE` per distribuire valori realistici
- Il `codice_ricerca` viene generato come `UPPER(LEFT(cognome,3) || LEFT(nome,2))` per i privati
- I cellulari fake seguono il formato italiano `3xx xxxxxxx`
- Il gruppo finanziario viene assegnato solo a clienti con indice pari (simulazione realistica)
- Nessun campo viene sovrascritto se già valorizzato (WHERE campo IS NULL)

