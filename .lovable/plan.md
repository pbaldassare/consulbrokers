
# Piano: Gestione Provvigioni Compagnie centralizzata in /compagnie

## Obiettivo
Spostare e ristrutturare la gestione delle % provvigione che **Direzioni / Agenzie / Broker / Plurimandatarie** riconoscono a **Consulbrokers** dentro la sezione `/compagnie` (stessa pagina dove gestiamo le agenzie e i loro rapporti). La % deve essere granulare per **Rapporto × Ramo × Sottoramo**, così quando si inserisce una polizza il sistema trova subito la % corretta.

## Cosa cambia rispetto a oggi
Oggi `provvigioni_compagnia_ramo` ha chiave `(compagnia_rapporto_id, categoria_id)` — cioè una sola % per "categoria prodotto". Troppo grossolano: Allianz Direzione su ramo AUTO ha % diverse tra RCA, ARD, Cristalli, Assistenza, Infortuni Conducente, ecc.

Nuovo modello: **una riga per ogni Sottoramo** (`rami.id`) del rapporto, con possibilità di una **riga "default ramo"** (`gruppo_ramo_id`, sottoramo NULL) usata come fallback.

## Esempi concreti

**Esempio 1 — Allianz Direzione (rapporto unico)**
```
Rapporto: "Allianz Direzione Livorno"
  Ramo AUTO (default ramo)        → 8%   [fallback per nuovi sottorami]
    Sottoramo RCA Auto            → 10%
    Sottoramo ARD                 → 18%
    Sottoramo Cristalli           → 22%
    Sottoramo Assistenza          → 25%
  Ramo INFORTUNI
    Sottoramo Inf. Conducente     → 20%
```

**Esempio 2 — Etisicura Broker (più rapporti con la stessa madre Nobis)**
```
Rapporto: "Nobis – Convenzione Etisicura A"
  Ramo RAMI ELEMENTARI / Casa     → 22%
Rapporto: "Nobis – Convenzione Etisicura B"
  Ramo RAMI ELEMENTARI / Casa     → 18%   (condizioni economiche diverse)
```
Quando si emette la polizza si sceglie **quale rapporto** → % corretta automatica.

## Struttura tabelle

### 1. Ristrutturazione `provvigioni_compagnia_ramo`
Aggiungere colonne:
- `gruppo_ramo_id` uuid → `gruppi_ramo(id)` (Ramo, es. AUTO)
- `ramo_id` uuid NULL → `rami(id)` (Sottoramo; NULL = "default del ramo")
- Mantenere `compagnia_rapporto_id` (chiave principale)
- Deprecare `categoria_id` (resta per back-compat, popolata via trigger se serve)
- Unique parziale: `(compagnia_rapporto_id, gruppo_ramo_id, ramo_id)` con `attiva = true` (NULLS NOT DISTINCT così "default ramo" è unico)

### 2. Default globale (livello tipo rapporto)
Nuova tabella `provvigioni_default_tipo` opzionale:
- `tipo_rapporto` (Direzione/Agenzia/Broker/Plurimandataria)
- `gruppo_ramo_id`, `ramo_id` NULL, `percentuale`
- Usata come **ultimo fallback** quando il rapporto non ha una sua %.

### 3. Catena di risoluzione (ordine lookup)
Quando si salva una riga di polizza per `(compagnia_rapporto_id, ramo_id)`:
1. match esatto `(rapporto, gruppo_ramo, ramo)` 
2. default ramo `(rapporto, gruppo_ramo, NULL)`
3. `percentuale_provvigione` sul `compagnia_rapporti` (% globale rapporto, già esistente)
4. default tipo `(tipo_rapporto, gruppo_ramo, NULL)`
5. 0 + warning UI

Esposta come RPC `risolvi_provvigione_compagnia(rapporto_id, ramo_id)` → numeric. Usata da `ImmissionePolizzaPage` per pre-popolare il campo % di ogni riga garanzia.

## UI in /compagnie

Nella pagina `/compagnie` la tab oggi placeholder **"Agenzie di riferimento – Prossimamente"** diventa **"Provvigioni"**. La pagina autonoma `/provvigioni-compagnie-ramo` viene rimossa dalla sidebar (redirect alla tab).

Layout tab Provvigioni:
- **Selettore Rapporto** in alto (searchable, mostra Compagnia madre + nome rapporto + tipo). Se l'agenzia ha 1 solo rapporto si seleziona da sola.
- **Pannello default globali tipo rapporto** (collassabile, in alto): griglia Tipo × Ramo con %.
- **Matrice rapporto selezionato**: 
  - Righe = Sottorami del Ramo
  - Raggruppate per Ramo con riga "Default ramo" in cima
  - Colonna unica `%` con inline edit
  - Badge "ereditato" quando la riga manca e usa fallback
- Pulsanti azione:
  - **Aggiungi tutti i sottorami** del catalogo (popola le righe vuote a 0 o al default ramo)
  - **Copia da altro rapporto** (select rapporto sorgente → clona tutte le righe)
  - **Incolla da CSV/Excel**: textarea che accetta `gruppo_ramo;sottoramo;%` o solo `sottoramo;%` (resolver per nome con fuzzy). Anteprima righe → conferma → upsert.
  - **Import AI da PDF/foto**: bottone che apre dialog con upload + Gemini 2.5 Flash (riusa `parse-provvigioni-pdf` adattata) → output strutturato `[{gruppo_ramo, sottoramo, percentuale}]` → stesso flusso anteprima dell'incolla.
  - **Export CSV** del rapporto corrente.

## Impatti su altri schermi

- `ImmissionePolizzaPage` / `TitoloDetail` — la card Premio per ogni sottoramo: il campo `% provvigione` viene pre-popolato via `risolvi_provvigione_compagnia` (con badge "auto" e possibilità override manuale).
- `ImportProvvigioniTab` (oggi in `CompagnieList`) — resta come canale di import massivo per i rendiconti pagati dalle compagnie, ma il **maintenance UI delle %** non sta più lì.
- Sidebar: rimuovere voce "Provvigioni Compagnie/Ramo" sotto gruppo Provvigioni (rimane solo dentro /compagnie).

## Migrazione dati

1. Backfill colonna `gruppo_ramo_id` su `provvigioni_compagnia_ramo`: per ogni riga con `categoria_id` si tenta match su `categorie_prodotto.nome` → `gruppi_ramo.descrizione/codice`. Match non risolti restano `NULL` con `attiva=false` e log in `log_attivita` per revisione manuale.
2. `ramo_id` resta NULL ⇒ trattata come "default ramo" → comportamento identico a oggi finché non si raffina.
3. Nessuna perdita dati: vecchio `categoria_id` non viene droppato.

## Sezione tecnica

**Migrazione SQL** (proposta):
```sql
ALTER TABLE provvigioni_compagnia_ramo
  ADD COLUMN gruppo_ramo_id uuid REFERENCES gruppi_ramo(id),
  ADD COLUMN ramo_id uuid REFERENCES rami(id);

CREATE UNIQUE INDEX provv_rapporto_ramo_unique
  ON provvigioni_compagnia_ramo (compagnia_rapporto_id, gruppo_ramo_id, ramo_id)
  NULLS NOT DISTINCT
  WHERE attiva = true;

CREATE TABLE provvigioni_default_tipo (
  id uuid PK default gen_random_uuid(),
  tipo_rapporto text NOT NULL,
  gruppo_ramo_id uuid REFERENCES gruppi_ramo(id),
  ramo_id uuid REFERENCES rami(id),
  percentuale numeric NOT NULL,
  attiva boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- RPC risolutore
CREATE FUNCTION risolvi_provvigione_compagnia(_rapporto uuid, _ramo uuid)
RETURNS numeric ...
```

**Frontend nuovi file**:
- `src/components/compagnie/ProvvigioniRapportoTab.tsx` (matrice + azioni)
- `src/components/compagnie/PasteProvvigioniDialog.tsx` (incolla CSV)
- `src/components/compagnie/AiImportProvvigioniDialog.tsx` (upload PDF + AI)
- `src/components/compagnie/CopiaProvvigioniDialog.tsx`
- `src/hooks/useProvvigioniMatrix.ts` (fetch + upsert)

**Edge function**:
- Generalizzare `parse-provvigioni-pdf` per accettare modalità `tariffario` (output `{gruppo_ramo, sottoramo, %}`) oltre alla modalità rendiconto esistente.

**Memoria progetto**: aggiornare `mem://features/provvigioni-compagnie-ramo-page` con il nuovo modello e creare `mem://insurance/provvigione-resolution-chain`.

## Conferme richieste prima di implementare
1. OK ad aggiungere `gruppo_ramo_id` + `ramo_id` su `provvigioni_compagnia_ramo` mantenendo `categoria_id` come legacy?
2. Spostare la pagina dentro la tab di /compagnie e rimuovere voce sidebar dedicata: confermi?
3. Catena di risoluzione proposta (sottoramo → default ramo → % rapporto → default tipo) va bene o vuoi un ordine diverso?
