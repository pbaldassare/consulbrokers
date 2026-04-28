## Obiettivo

Permettere ad un'**agenzia plurimandataria** o ad un **broker** di avere **più rapporti contemporanei con compagnie diverse** (es. Eticura ↔ Unipol, Helvetia, Bene), tracciandoli e distinguendoli singolarmente, con persistenza in DB e storico completo.

Oggi `compagnie.gruppo_compagnia_id` è un singolo riferimento (1:1 verso `gruppi_compagnia`). Servono rapporti **N:N** tra `compagnie` (agenzia) e `gruppi_compagnia` (compagnia madre).

---

## 1. Database — nuova tabella `compagnia_rapporti`

```sql
CREATE TABLE public.compagnia_rapporti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compagnia_id uuid NOT NULL REFERENCES compagnie(id) ON DELETE CASCADE,
  gruppo_compagnia_id uuid NOT NULL REFERENCES gruppi_compagnia(id) ON DELETE RESTRICT,
  
  -- Dati distintivi del rapporto
  codice_rapporto text,            -- es. codice agenzia presso quella compagnia
  tipo_rapporto text,              -- "Mandato diretto", "Sub-agenzia", "Convenzione broker", ecc.
  rami_abilitati text[],           -- es. ["RCA","Vita","Property"]
  data_inizio date,
  data_fine date,                  -- NULL = ancora attivo
  attivo boolean NOT NULL DEFAULT true,
  
  -- Tracciabilità economica
  percentuale_provvigione numeric(5,2),
  iban_dedicato text,
  referente_compagnia text,
  email_referente text,
  telefono_referente text,
  
  note text,
  
  -- Audit
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  
  UNIQUE (compagnia_id, gruppo_compagnia_id, data_inizio)
);

CREATE INDEX ON compagnia_rapporti (compagnia_id);
CREATE INDEX ON compagnia_rapporti (gruppo_compagnia_id);
CREATE INDEX ON compagnia_rapporti (attivo) WHERE attivo = true;
```

**RLS**: lettura per utenti autenticati interni; scrittura riservata a ruoli admin/compagnie (allineata alle policy esistenti su `compagnie`).

**Trigger di logging**: insert/update/delete loggati nella `attivita_log` esistente per timeline (entità `compagnia`, ID = `compagnia_id`).

**Migrazione dati esistenti**: per ogni `compagnie` con `gruppo_compagnia_id` valorizzato, creare un primo rapporto in `compagnia_rapporti` (così non si perdono i collegamenti correnti). Il campo `compagnie.gruppo_compagnia_id` resta come "rapporto principale/legacy" — non rimosso ora per non rompere viste/report.

---

## 2. UI — Modale "Gestione Rapporti" in `/compagnie`

Nella riga di ogni agenzia (tab "Anagrafica Agenzie") aggiungere un'icona **Network** (`Layers`/`Network` lucide) nella colonna azioni → apre un **Dialog** dedicato.

**Header del modale**: nome agenzia + chip "Plurimandataria" / "Broker" (visibile solo se l'agenzia è plurimandataria, broker o ha già >1 rapporto — altrimenti pulsante visibile ma con avviso).

**Corpo**:
- Tabella zebrata dei rapporti esistenti con colonne:
  `Compagnia` · `Codice rapporto` · `Tipo` · `Rami` · `Inizio` · `Fine` · `% Provv.` · `Stato` · `Azioni (Edit/Chiudi/Elimina)`
- Bottone **"+ Nuovo Rapporto"** apre form inline con:
  - `SearchableSelect` Compagnia madre (da `gruppi_compagnia`, escludendo quelle già attive per evitare duplicati)
  - Codice rapporto
  - Tipo rapporto (select: Mandato diretto / Sub-agenzia / Convenzione broker / Coverholder / Altro)
  - Rami abilitati (multi-select)
  - Data inizio (default oggi) · Data fine (opzionale)
  - % provvigione · IBAN dedicato
  - Referente (nome, email, telefono)
  - Note
- Azione **"Chiudi rapporto"** → setta `data_fine = oggi` e `attivo = false` (non cancella, mantiene storico).

**Indicatori in lista agenzie**: nella tabella esistente, accanto al nome dell'agenzia mostrare un badge `N rapporti` cliccabile che apre direttamente il modale.

---

## 3. Tracciabilità

- Ogni create/update/delete su `compagnia_rapporti` viene loggato via trigger DB → visibile nella timeline esistente dell'agenzia.
- Il modale mostra in fondo una mini-timeline degli ultimi 10 eventi sui rapporti di quella agenzia.

---

## Dettagli tecnici

**File coinvolti**:
- Nuova migrazione SQL: tabella `compagnia_rapporti` + RLS + trigger + backfill iniziale.
- `src/pages/CompagnieList.tsx` — aggiunta colonna azione "Rapporti" + dialog.
- Nuovo componente `src/components/compagnie/RapportiCompagniaDialog.tsx` — gestione CRUD rapporti.
- Hook `useRapportiCompagnia(compagniaId)` con React Query (chiavi: `['rapporti-compagnia', compagniaId]`).

**Pattern**: `SearchableSelect` per la scelta compagnia madre (rispetta la convenzione di progetto), tabella zebrata, debounce 350ms su ricerche, paginazione non necessaria (rapporti per agenzia tipicamente < 50).

**Cosa NON tocchiamo ora**:
- `compagnie.gruppo_compagnia_id` resta valorizzato (rapporto "principale" legacy) per non rompere viste/report esistenti.
- I report che oggi raggruppano per `gruppo_compagnia_id` continueranno a funzionare; in una fase successiva si potranno migrare a leggere i rapporti attivi.

---

## Domanda prima di procedere

Vuoi che il pulsante "Gestione Rapporti" sia visibile **su tutte le agenzie** o **solo su quelle marcate come Plurimandatario/Broker**? (default proposto: visibile su tutte, ma evidenziato con badge sulle plurimandatarie/broker).
