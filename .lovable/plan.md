

## Piano: Creare Tabella Fornitori e Caricare Dati

### Dati dal file Excel
Il file contiene ~1465 fornitori con le colonne: Cod, Nome, Indirizzo, CAP, Localita, Prov, Naz, C.F., P-Iva, Mail, Pec, UltFattura, StSog (Stato Soggetto), StCli (Stato Cliente), StFor (Stato Fornitore).

### Cosa faremo

#### 1. Migration: Creare tabella `fornitori`
Nuova tabella con i campi corrispondenti alle colonne Excel:

| Colonna DB | Tipo | Da colonna Excel |
|---|---|---|
| `id` | uuid PK | auto |
| `codice` | text UNIQUE | Cod |
| `nome` | text NOT NULL | Nome |
| `indirizzo` | text | Indirizzo |
| `cap` | text | CAP |
| `localita` | text | Località |
| `provincia` | text | Prov |
| `nazione` | text DEFAULT 'IT' | Naz |
| `codice_fiscale` | text | C.F. |
| `partita_iva` | text | P-Iva |
| `email` | text | Mail |
| `pec` | text | Pec |
| `ultima_fattura` | date | UltFattura |
| `stato_soggetto` | boolean | StSog (X = true) |
| `stato_cliente` | boolean | StCli (X = true) |
| `stato_fornitore` | boolean | StFor (X = true) |
| `attivo` | boolean DEFAULT true | - |
| `ufficio_id` | uuid | - |
| `created_at` | timestamptz | auto |

RLS: Admin full, CFO/Contabilita select, Ufficio CRUD own.

#### 2. Caricare i ~1465 record via script
Usare uno script per parsare l'Excel e inserire tutti i record nella tabella `fornitori` tramite Supabase insert.

#### 3. Creare pagina `FornitoriPage.tsx`
Sostituire il PlaceholderPage con una pagina completa:
- Tabella con ricerca, paginazione server-side
- Colonne: Codice, Nome, Localita, Prov, P.IVA, Email, Ultima Fattura, Stato
- Dialog per creare/modificare fornitore
- Filtri per provincia, stato attivo

#### 4. Aggiornare routing
In `App.tsx`, sostituire il PlaceholderPage di `/cont-generale/fornitori` con `FornitoriPage`.

### File coinvolti

| Azione | File |
|---|---|
| Migration | Nuova tabella `fornitori` + RLS |
| Script | Caricamento dati Excel |
| Creare | `src/pages/FornitoriPage.tsx` |
| Modificare | `src/App.tsx` — rotta fornitori |
| Aggiornare | `src/integrations/supabase/types.ts` — tipi generati |

