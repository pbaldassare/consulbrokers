

## Piano: Trasformare i Dati Statistici da testo libero a tabelle di lookup

### Analisi situazione attuale

| Campo | DB attuale | Vecchio sistema | Tabella lookup |
|---|---|---|---|
| **Zona** | `text` libero (4 valori: Centro, Isole, Nord, Sud) | Dropdown con 14 valori (CENTRO, EMILIA ROMAGNA, ESTERO, ISOLE, LAZIO, LOMBARDIA, ecc.) | **Da creare** |
| **Indotto** | `text` libero (9 valori: ASL, CCIAA, Comune...) | Dropdown (Gruppo ENTI PUBBLICI, ecc.) | **Da creare** |
| **Attivita** | `text` libero (13 valori) | Dropdown con 50+ voci (AEREOPORTI, AGENTI, AGRICOLTORI, ALIMENTARI, ARTIGIANI, ASSESSORE...) | **Da creare** |
| **Settore** | `text` libero (20 valori) | Dropdown con ~10 voci (Agricoltura, Edilizia Privata, Edilizia Pubblica, Gestione Rifiuti...) | **Da creare** |
| **Contratto** | `text` (vuoto, 0 valori) | Dropdown ("Specificare il Contratto") | **Da creare** |
| **Fatturato** | `numeric` | Dropdown con **fasce**: fino a 2M, 2-5M, 5-10M, 10-50M, 50-100M, 100-200M, oltre 200M | **Da creare** (fasce) |
| **Num. Dipendenti** | `integer` | Dropdown con **fasce**: Fino a 9, 10-49, 50-249, 250-499, oltre 500 | **Da creare** (fasce) |
| **Gruppo Finanziario** | FK a `gruppi_finanziari` | Dropdown lungo (Enti Pubblici Territoriali, Aziende Private, ecc.) | **Esiste** ma con dati sbagliati (contiene compagnie assicurative, non i gruppi del vecchio sistema) |
| **Gruppo Statistico** | `text` libero | Dropdown simile a Gruppo Finanziario | **Esiste** `gruppi_statistici` (5 record: PA, ENTI, SOCIETA', PRIVATI, PROFESSIONISTI) ma non collegato come FK |
| **Codice ATECO** | `text` | Campo libero | OK cosi com'e |

### Cosa fare

**1. Creare 7 tabelle di lookup** (migrazione SQL)

Tutte con struttura: `id uuid PK, codice text, descrizione text, attivo boolean, created_at timestamp`

- `lookup_zone` — 14 valori dal vecchio sistema
- `lookup_indotti` — valori dal vecchio sistema + quelli gia in DB
- `lookup_attivita` — 50+ valori dal vecchio sistema
- `lookup_settori` — ~10 valori dal vecchio sistema
- `lookup_contratti` — valori base (da definire, il vecchio sistema non mostra i valori)
- `lookup_fasce_fatturato` — 7 fasce con ordine
- `lookup_fasce_dipendenti` — 5 fasce con ordine

**2. Sistemare Gruppo Finanziario**

La tabella `gruppi_finanziari` contiene valori errati (Allianz, Generali = sono compagnie, non gruppi finanziari del cliente). Va ripopolata con i valori corretti dal vecchio sistema: Enti Pubblici Territoriali, Aziende Private, Aziende Sanitarie, Ass.ne Sportiva Dilettantistica, ecc.

**3. Collegare Gruppo Statistico**

Cambiare `gruppo_statistico` da `text` a FK verso `gruppi_statistici`. La tabella esiste gia con 5 valori sensati.

**4. Cambiare Fatturato e Num. Dipendenti**

Aggiungere campi `fascia_fatturato` e `fascia_dipendenti` (text) al posto di usare i campi numerici per i dropdown. I campi numerici restano per eventuali valori precisi.

**5. Aggiornare la UI** (ClienteDetail.tsx + ClientiList.tsx)

Ogni campo diventa un `SearchableSelect` che legge dalla rispettiva tabella di lookup. Query con `useQuery` per caricare le opzioni.

### File da modificare

- **1 migrazione SQL**: crea 7 tabelle, popola dati, ripopola `gruppi_finanziari`, aggiunge colonne `fascia_fatturato`/`fascia_dipendenti`/`gruppo_statistico_id`
- **`src/pages/ClienteDetail.tsx`**: sezione Dati Statistici — tutti i campi da `FieldInput` a `SearchableSelect`
- **`src/pages/ClientiList.tsx`**: stessa cosa nel dialog di creazione

### Domanda aperta

Per il campo **Contratto**, il vecchio sistema mostra solo "Specificare il Contratto" senza valori visibili. Servira che tu mi fornisca la lista dei valori possibili, oppure creo la tabella vuota e li aggiungiamo dopo.

