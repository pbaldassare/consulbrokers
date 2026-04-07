

## Piano: Ristrutturazione Trattative (Cliente + Prospect, Rami, Note, Log)

### Problema attuale
- La tabella `trattative` è collegata **solo a `prospect_id`** — impossibile creare trattative per clienti
- I campi `prodotto` e `compagnia` sono testo libero — non collegati ai rami/compagnie del DB
- Manca un campo note editabile
- La form di creazione è minimale e i campi non sono modificabili dopo la creazione

### Struttura DB attuale

```text
trattative
├── id (uuid PK)
├── prospect_id (FK → prospect) — unico riferimento entità
├── prodotto (text libero)
├── compagnia (text libero)
├── premio_previsto (numeric)
├── stato (check: aperta/in_negoziazione/chiusa_vinta/chiusa_persa)
├── data_chiusura (timestamptz)
├── created_by (FK → profiles)
├── created_at / updated_at
```

### Modifiche Database (migrazione SQL)

**1. ALTER TABLE `trattative`** — aggiungere nuovi campi:

| Nuovo campo | Tipo | Descrizione |
|---|---|---|
| `cliente_id` | uuid FK → clienti(id) | Collegamento a cliente (alternativo a prospect_id) |
| `ramo_id` | uuid FK → rami(id) | Ramo assicurativo dal DB |
| `compagnia_id` | uuid FK → compagnie(id) | Compagnia dal DB (sostituisce testo libero) |
| `note` | text | Campo note libero, editabile |

**2. CHECK constraint**: almeno uno tra `prospect_id` e `cliente_id` deve essere valorizzato (non entrambi NULL).

**3. Aggiornare RLS policies** per includere `cliente_id` nelle condizioni di accesso (ufficio/produttore).

### Modifiche Frontend

**1. `TrattativeList.tsx`** — lista globale:
- Aggiungere colonna "Tipo" (Prospect/Cliente) e colonna "Ramo"
- La colonna soggetto mostra il nome prospect O cliente
- Query aggiornata con JOIN a `clienti`, `rami`, `compagnie`
- Pulsante **"Nuova Trattativa"** che apre dialog con:
  - Scelta Prospect/Cliente (radio) + SearchableSelect per selezionare
  - Ramo (SearchableSelect → tabella `rami`)
  - Compagnia (SearchableSelect → tabella `compagnie`)
  - Premio previsto
  - Note
- Click su riga → apre dialog di modifica con tutti i campi editabili
- Ogni modifica viene loggata via `logAttivita`

**2. `ProspectDetail.tsx`** — form creazione trattativa:
- Sostituire input testo `prodotto`/`compagnia` con SearchableSelect per `ramo_id` e `compagnia_id`
- Aggiungere campo Note
- Mantenere `prospect_id` precompilato

**3. `ClienteDetail.tsx`** — aggiungere sezione trattative:
- Aggiungere tab/sezione "Trattative" nel dettaglio cliente
- Stessa logica di ProspectDetail: lista trattative + pulsante crea
- Usa `cliente_id` invece di `prospect_id`

**4. Dettaglio trattativa inline** (dialog di modifica):
- Tutti i campi editabili: ramo, compagnia, premio, note, stato
- Ogni salvataggio logga le modifiche con `logAttivita` (campo modificato, valore precedente, nuovo valore)

### File coinvolti

| File | Azione |
|---|---|
| Migrazione SQL | ALTER TABLE + CHECK + RLS update |
| `src/pages/TrattativeList.tsx` | Refactor completo: nuovi JOIN, dialog crea/modifica, colonne aggiornate |
| `src/pages/ProspectDetail.tsx` | Form trattativa con SearchableSelect per ramo/compagnia + note |
| `src/pages/ClienteDetail.tsx` | Aggiungere sezione trattative con crea/lista |
| `src/integrations/supabase/types.ts` | Aggiornare tipo `trattative` con nuovi campi |

### Dati preservati
I 16 trattative esistenti mantengono `prospect_id` e i campi testo `prodotto`/`compagnia` — i nuovi campi `ramo_id`, `compagnia_id`, `cliente_id` saranno NULL per i record esistenti, nessun dato perso.

