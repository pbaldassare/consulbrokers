## Modifiche form Nuova Agenzia (`src/pages/CompagnieList.tsx`)

### 1. Spacing & layout Identificativi
- Cambio griglia tab Identificativi da 3 colonne strette a layout più respirato:
  - Riga 1: **Tipo** (full width, radio group con spacing largo)
  - Riga 2: **Codice** (1/2) · **Stato** (1/2)
  - Riga 3: **Ragione sociale** (full width)
  - Riga 4: **Compagnia madre** (full width, condizionale)
- Fix radio "Direzione" troncato: aumento gap tra radio e uso `flex-wrap` con `min-w` adeguato per ogni opzione.

### 2. Nuovo tipo: Plurimandataria
- Aggiungo `plurimandataria` come quarta opzione radio nel campo Tipo.
- Aggiornamento check constraint DB su `compagnie.tipo` per includere il nuovo valore (migrazione).
- Badge in tabella: colore distinto (es. arancio) per plurimandataria.
- Filtro tab elenco: aggiungo "Plurimandataria" tra le opzioni.

### 3. Compagnia madre — condizionale + opzione vuota
- **Visibile solo se** `tipo === 'agenzia'` o `tipo === 'direzione'`.
- **Nascosta** per `broker` e `plurimandataria` (i loro legami con le compagnie sono gestiti tramite `compagnia_rapporti`).
- Nel `SearchableSelect`: aggiungo opzione esplicita "— Nessuna —" (value vuoto) in testa alla lista, così l'utente può deselezionare.
- Validazione: obbligatoria solo per agenzia/direzione.

### 4. Rimozione tab Provvigioni dalla form
- Elimino la tab "Provvigioni" dal dialog di creazione/modifica agenzia (resta 3 tab: Identificativi · Anagrafica · RUI & Bancario).
- La gestione provvigioni resta nella pagina dedicata già esistente (`ProvvigioniMaturatePage` / sezione provvigioni compagnia-ramo).
- Dalla riga agenzia in tabella mantengo un link/azione "Provvigioni" che porta alla pagina dedicata filtrata sulla compagnia.

### 5. Memoria
Aggiorno `mem://insurance/compagnie-form-pulita`:
- Tipi: agenzia / broker / direzione / **plurimandataria**
- Compagnia madre obbligatoria solo per agenzia/direzione
- Provvigioni gestite in pagina separata, non nella form compagnia

---

### Dettagli tecnici
- Migrazione SQL: `ALTER TABLE compagnie DROP CONSTRAINT IF EXISTS compagnie_tipo_check; ADD CONSTRAINT compagnie_tipo_check CHECK (tipo IN ('agenzia','broker','direzione','plurimandataria'));`
- File toccati: `src/pages/CompagnieList.tsx`, una migrazione SQL, file memoria.
- Nessun impatto su `compagnia_rapporti` (già pensato per legami N:N broker/plurimandatarie ↔ compagnie).

### Conferme
1. OK aggiungere `plurimandataria` come tipo separato (non sinonimo di broker)?
2. Link "Provvigioni" sulla riga tabella che porta alla pagina dedicata: OK o preferisci toglierlo del tutto dalla form?
