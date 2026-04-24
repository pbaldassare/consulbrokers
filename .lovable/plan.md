

## Collegamento Compagnie ↔ Agenzie + gestione "Plurimandatario"

### Obiettivo

Garantire che ogni **Agenzia** (tabella `compagnie`) sia sempre collegata a una **Compagnia** (tabella `gruppi_compagnia`) — cioè `compagnie.gruppo_compagnia_id` sempre valorizzato. Per le agenzie attualmente orfane (76 record senza `gruppo_compagnia_id`), creare una Compagnia speciale **"PLURIMANDATARIO"** come fallback temporaneo, da risistemare in seguito.

### Analisi stato attuale

Dai dati che già conosciamo (memoria progetto + step precedente):
- **Tabella `gruppi_compagnia`** (UI: "Compagnia"): 134 record, FK `compagnie.gruppo_compagnia_id → gruppi_compagnia.id` (già esiste).
- **Tabella `compagnie`** (UI: "Agenzia"): 1.374 record di cui:
  - 1.298 con `gruppo_compagnia_id` valorizzato → OK
  - **76 orfane** con `gruppo_compagnia_id IS NULL` → da assegnare

Verifico in fase di esecuzione il count esatto e i nomi delle 76 agenzie orfane (potrebbero essere broker plurimandatari, agenzie generiche, o dati incompleti) prima di assegnarle in massa.

### Soluzione proposta

#### 1. Migrazione DB (singola)

**a)** Inserire un record speciale in `gruppi_compagnia`:
```sql
INSERT INTO gruppi_compagnia (codice, descrizione, attivo)
VALUES ('PLURIMANDATARIO', 'PLURIMANDATARIO', true)
ON CONFLICT (codice) DO NOTHING
RETURNING id;
```
Lo identifico con codice `PLURIMANDATARIO` (univoco) per poterlo riconoscere facilmente in UI ed edge functions.

**b)** Assegnare tutte le 76 agenzie orfane a questa Compagnia speciale:
```sql
UPDATE compagnie
SET gruppo_compagnia_id = (SELECT id FROM gruppi_compagnia WHERE codice = 'PLURIMANDATARIO')
WHERE gruppo_compagnia_id IS NULL;
```

**c)** Aggiungere il vincolo NOT NULL su `compagnie.gruppo_compagnia_id` (così d'ora in poi nessuna agenzia può essere creata senza Compagnia padre):
```sql
ALTER TABLE compagnie 
ALTER COLUMN gruppo_compagnia_id SET NOT NULL;
```

**d)** (Opzionale ma consigliato) Aggiungere un commento sul record speciale per ricordarlo:
```sql
COMMENT ON COLUMN compagnie.gruppo_compagnia_id IS 
'Compagnia di appartenenza (obbligatoria). Le agenzie senza una vera Compagnia sono assegnate al fallback PLURIMANDATARIO.';
```

#### 2. Modifiche UI in `CompagnieList.tsx`

**a) Form Agenzia (creazione/modifica)**:
- Campo "Compagnia di appartenenza" diventa **obbligatorio** (asterisco rosso, validazione client + server).
- Nel select, mostrare il record `PLURIMANDATARIO` con un'icona/badge giallo "⚠️ Fallback" per scoraggiarne l'uso senza motivo.

**b) Tab "Agenzie"** (lista):
- Aggiungere una **colonna "Compagnia"** che mostra `descrizione` del gruppo padre, leggendo via JOIN su `gruppi_compagnia`.
- Aggiungere un **filtro rapido** "Solo Plurimandatario" per filtrare velocemente le 76 (+ future) agenzie da risistemare.
- Badge giallo "⚠️ Plurimandatario" sulla riga, in modo visibile, per le agenzie assegnate al fallback.

**c) Tab "Compagnie"** (gestione `gruppi_compagnia`):
- Il record `PLURIMANDATARIO` viene mostrato in cima alla lista con badge speciale "Fallback di sistema".
- Il record `PLURIMANDATARIO` **non può essere eliminato** né rinominato (codice protetto): mostro un alert se l'utente prova.

#### 3. Verifica integrità in altre parti del sistema

Cerco riferimenti a `gruppo_compagnia_id` nel codice (UI + edge functions) per verificare che la NOT NULL constraint non rompa flussi esistenti:
- `import-compagnie/index.ts`: già gestisce `gruppo_compagnia` opzionale → in caso di valore mancante o non trovato in `groupMap`, dovrà fare fallback al PLURIMANDATARIO invece che inserire NULL.
- Form di import bulk (se esistono): aggiornare per usare lo stesso fallback.

#### 4. Edge function `import-compagnie` — aggiornamento minimo

Modifico la riga 60 di `supabase/functions/import-compagnie/index.ts`:
```ts
gruppo_compagnia_id: c.gruppo_compagnia 
  ? (groupMap[c.gruppo_compagnia] || PLURIMANDATARIO_ID) 
  : PLURIMANDATARIO_ID,
```
dove `PLURIMANDATARIO_ID` viene fetchato all'inizio della function con una query su `gruppi_compagnia WHERE codice = 'PLURIMANDATARIO'`.

### File modificati

1. **Migrazione SQL** (singola transazione): inserisce record PLURIMANDATARIO + UPDATE delle 76 orfane + ALTER TABLE NOT NULL.
2. **`src/pages/CompagnieList.tsx`**:
   - Tab Agenzie: nuova colonna "Compagnia" con JOIN, filtro "Solo Plurimandatario", badge giallo.
   - Form Agenzia: campo "Compagnia di appartenenza" obbligatorio + badge fallback nel select.
   - Tab Compagnie: PLURIMANDATARIO in cima con badge "Fallback di sistema", protetto da delete/rename.
3. **`supabase/functions/import-compagnie/index.ts`**: fallback automatico a PLURIMANDATARIO se gruppo non trovato/null.

### Cosa NON tocco

- ❌ Nessuna modifica alla logica polizze, sinistri, provvigioni — l'FK esisteva già, aggiungo solo il NOT NULL.
- ❌ Nessuna rinomina di colonne DB.
- ❌ Le 76 agenzie restano modificabili: in futuro le riassegnerai manualmente a Compagnie reali tramite la tab "Agenzie" filtrata.
- ❌ Il livello 3 ("Agenzie di riferimento") resta non implementato (placeholder come deciso allo step precedente).

### Verifica

1. **DB**: query `SELECT COUNT(*) FROM compagnie WHERE gruppo_compagnia_id IS NULL` → restituisce **0**.
2. **DB**: query `SELECT descrizione, COUNT(c.id) FROM gruppi_compagnia g LEFT JOIN compagnie c ON c.gruppo_compagnia_id = g.id WHERE g.codice = 'PLURIMANDATARIO' GROUP BY g.descrizione` → restituisce **76**.
3. **UI `/compagnie` Tab Compagnie**: vedo "PLURIMANDATARIO" in cima con badge "Fallback di sistema" e count `76 agenzie`.
4. **UI Tab Agenzie**: filtro "Solo Plurimandatario" mostra esattamente 76 record con badge giallo. Nuova colonna "Compagnia" valorizzata su tutte le righe.
5. **UI form Agenzia**: provando a salvare senza compagnia → errore di validazione ("Compagnia di appartenenza obbligatoria").
6. **Tentativo delete su PLURIMANDATARIO**: bloccato con messaggio "Compagnia di sistema, non eliminabile".
7. **Import compagnie via edge function** con `gruppo_compagnia` mancante: il record viene comunque creato e assegnato a PLURIMANDATARIO (non più NULL).

### Prossimi step (dopo questa implementazione)

- Tu (o un admin) usa il filtro "Solo Plurimandatario" nella tab Agenzie per riassegnare manualmente, una alla volta, le 76 agenzie alla loro vera Compagnia.
- Quando il count delle agenzie sotto PLURIMANDATARIO scende a 0 (o quando deciderai), si potrà valutare se rimuovere il record speciale o tenerlo come fallback permanente per nuovi import.

