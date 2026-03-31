

## Piano: Tabelle Base RCA Auto concatenate

### Dati dai file Excel

**3 tabelle interconnesse:**

1. **Settori RCA** (tipologie_di_rca.xlsx) — 16 record
   - Codice settore (01-16) + Descrizione (Autovetture, Autobus, Autocarri, ecc.)

2. **Usi RCA** (tabella_uso_rca_auto.xlsx) — 43 record
   - Ogni uso è legato a un settore (FK settore)
   - Codice uso + Descrizione (Privato, Conto Terzi, Scuola Guida, ecc.)

3. **Garanzie RCA** (tabelal_settori_rca_auto.xlsm) — 17 record
   - Codice garanzia + Descrizione + **%Tasse** (aliquota fiscale)
   - Es: Cristalli 13.5%, Infortuni 2.5%, Black Box 0%

### Struttura relazionale

```text
rca_settori (16 record)
  ├── id, codice, descrizione, attivo
  │
  └──< rca_usi (43 record)
        ├── id, settore_id (FK → rca_settori), codice, descrizione, attivo
        │
rca_garanzie (17 record, indipendente)
  ├── id, codice, descrizione, aliquota_tasse (%), attivo
```

### Modifiche

**1. Migrazione DB — 3 tabelle nuove**

```sql
CREATE TABLE rca_settori (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text NOT NULL UNIQUE,
  descrizione text NOT NULL,
  attivo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE rca_usi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settore_id uuid REFERENCES rca_settori(id) ON DELETE CASCADE NOT NULL,
  codice text NOT NULL,
  descrizione text NOT NULL,
  attivo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(settore_id, codice)
);

CREATE TABLE rca_garanzie (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text NOT NULL UNIQUE,
  descrizione text NOT NULL,
  aliquota_tasse numeric(5,2) DEFAULT 0,
  attivo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

+ RLS policies per admin/ufficio + INSERT dei dati iniziali (16 settori, 43 usi, 17 garanzie)

**2. UI — 3 nuovi tab in TabelleBasePage**

- **Tab "Settori RCA"**: tabella CRUD classica (codice + descrizione)
- **Tab "Usi RCA"**: tabella con colonna **Settore** (select da rca_settori) + codice + descrizione — filtro per settore
- **Tab "Garanzie RCA"**: tabella con codice + descrizione + **% Tasse** (campo numerico editabile)

Ogni tab usa lo stesso pattern CRUD già esistente nella pagina, con dialog di creazione/modifica.

**3. Aggiornamento types.ts**
- Automatico dopo la migrazione

### File coinvolti

| Azione | File |
|--------|------|
| Migrazione | Crea tabelle + inserisce dati iniziali |
| Modifica | `src/pages/TabelleBasePage.tsx` — 3 nuovi tab + componenti custom |
| Aggiornamento | `src/integrations/supabase/types.ts` |

