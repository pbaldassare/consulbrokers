

## Piano: Allineare il Dettaglio Polizza al vecchio sistema

### Analisi dello screenshot

Lo screenshot mostra il **DETTAGLIO POLIZZA** del vecchio sistema per il COMUNE DI SANTA MARINA SALINA. Confrontandolo con il nostro `TitoloDetail.tsx`, emergono queste differenze:

#### 1. Header DATI — campi mancanti dal cliente
Il vecchio sistema mostra nella testata della polizza anche dati ereditati dal cliente:
- **Attivita** (es. "CATEGORIA DA DEFINIRE")
- **Gr. Fin** (es. "Enti Pubblici Territoriali")
- **Gr. Stat** (es. "Gruppo ENTI PUBBLICI DIVERSI")

Attualmente il nostro detail mostra il link al cliente ma non questi campi. Vanno aggiunti nella sezione Contratto.

#### 2. Tab mancanti
Il vecchio sistema ha tab: **FAMILIARI**, **GARANZIE**, **NOTE**, **CORRISPONDENZA**, **ANAGRAFICA**, **ARCHIVIO**.
Noi abbiamo: Provvigioni, Documenti, Chat, Timeline.

Mappatura:
- **FAMILIARI** → tab per soggetti collegati alla polizza (assicurati, beneficiari) — concetto nuovo
- **GARANZIE** → dettaglio coperture/garanzie della polizza — concetto nuovo
- **NOTE** → esiste come campo testo, va promossa a tab
- **CORRISPONDENZA** → mappabile sulla nostra Chat
- **ANAGRAFICA** → dati anagrafici del cliente (link)
- **ARCHIVIO** → mappabile sui nostri Documenti

#### 3. DETTAGLIO MOVIMENTI — concetto completamente mancante
Questo e la differenza piu importante. Il vecchio sistema mostra una tabella di **movimenti della polizza** — ogni riga rappresenta un'operazione (polizza base, rinnovo, appendice, storno, ecc.) con:

| Colonna | Significato |
|---|---|
| Rg (Riga) | Numero progressivo riga |
| App (Appendice) | Numero appendice |
| Data Movimento | Data registrazione |
| Effetto | Data decorrenza |
| Scadenza | Data scadenza rata |
| Rinnovo | Tipo rinnovo (es. "Tacito rinnovo") |
| Descrizione | Es. "CIG: B6554C6288" |
| Val | Valuta (EURO) |
| Premio | Importo premio |
| Provvigioni | Importo provvigioni |
| Tipo | Es. "Polizza Base" |
| Inc | Flag incasso |
| Copertura | Data copertura |
| Incasso | Data incasso |
| Stato | Icona stato |
| Sost-> / <-Sost | Sostituisce / Sostituito da |

Questo e il cuore della gestione polizze: ogni polizza ha una storia di movimenti. Attualmente NON abbiamo una tabella `movimenti_polizza` nel DB — esiste solo `movimenti_contabili` che e per la contabilita ufficio.

### Cosa fare

**1. Nuova tabella DB: `movimenti_polizza`**
Struttura:
- `id`, `titolo_id` (FK), `riga`, `appendice`
- `data_movimento`, `data_effetto`, `data_scadenza`, `data_rinnovo`
- `tipo_rinnovo` (text: Tacito rinnovo, Libera, ecc.)
- `descrizione`, `valuta`, `premio`, `provvigioni`
- `tipo` (text: Polizza Base, Appendice, Rinnovo, Storno)
- `incassato` (boolean), `data_copertura`, `data_incasso`
- `stato` (text)
- `sostituisce_id` (FK self-ref), `sostituito_da_id`
- RLS: admin all, ufficio per proprio ufficio, backoffice select

**2. Aggiornare `TitoloDetail.tsx`**
- Aggiungere nella sezione Contratto i campi dal cliente: **Attivita**, **Gr. Finanziario**, **Gr. Statistico** (fetch join su `clienti`)
- Aggiungere sezione **DETTAGLIO MOVIMENTI** con tabella come nel vecchio sistema
- Riorganizzare le tab: aggiungere **Garanzie** e **Familiari** (anche se inizialmente vuote)

**3. Aggiornare `types.ts`** per il nuovo tipo `movimenti_polizza`

**4. Auto-creazione primo movimento**
Quando si salva una nuova polizza in `ImmissionePolizzaPage`, creare automaticamente il primo movimento di tipo "Polizza Base" con i dati della polizza.

### File da modificare
- **1 nuova migrazione SQL** — crea `movimenti_polizza` con RLS
- **`src/pages/TitoloDetail.tsx`** — aggiungere movimenti, campi cliente, tab
- **`src/pages/ImmissionePolizzaPage.tsx`** — auto-creazione primo movimento
- **`src/integrations/supabase/types.ts`** — nuovo tipo

