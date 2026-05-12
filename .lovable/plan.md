## Obiettivo

1. Garantire che ogni voce della sidebar abbia una rotta valida (placeholder per quelle non ancora implementate).
2. Uniformare intestazioni, label colonne e copy nei tab "Compagnie Assicurative" e "Agenzie".
3. Esporre in modo strutturato (UI + DB già esistente) la relazione **Compagnia Assicurativa ↔ Agenzie**, sia 1:N sia N:N (plurimandatarie), eliminando qualunque mapping hardcoded.

---

## 1) Routing — placeholder per voci sidebar

### Stato attuale
La sidebar (`src/components/AppSidebar.tsx`) elenca ~50 voci raggruppate. Le route registrate stanno in `src/routes/{archivi,portafoglio,contabilita,sistema,sinistri,cliente,prospect}.tsx`. Alcune voci puntano a path che oggi cadono su `NotFound` (es. nei gruppi Sistema, Provvigioni, Sinistri sotto-sezioni, Trattative/Storico Gare ecc.).

### Cosa fare
- Censire ogni `path` presente in `sidebarEntries` e confrontarlo con le `<Route>` registrate.
- Per ogni path mancante, aggiungere una `<Route>` che rende `PlaceholderPage` (componente già esistente in `src/components/PlaceholderPage.tsx`) con:
  - `title` = label sidebar
  - `description` = breve descrizione coerente
  - `icon` = stessa icona usata nella sidebar
- Le rotte placeholder vanno collocate nel file `src/routes/*.tsx` tematicamente più vicino (o in un nuovo `src/routes/extra.tsx` se non c'è una corrispondenza chiara) e montate in `App.tsx` se serve.
- Nessuna logica di business: solo scaffolding di pagina con header/breadcrumb coerenti con il resto.

### Out of scope
- Implementazione vera dei placeholder (verrà fatta in iterazioni dedicate).

---

## 2) Uniformità tab "Compagnie Assicurative" e "Agenzie"

File: `src/pages/CompagnieList.tsx`.

Le rinominazioni testuali sono già state applicate. Resta da uniformare struttura/colonne/copy fra i due tab gemelli:

### Header del tab (entrambi)
Stessa anatomia in `Card`:
- Titolo `CardTitle` con conteggio: `Compagnie Assicurative ({n})` / `Agenzie ({n})`
- `CardDescription` breve che spiega cosa è l'entità (1 riga).
- Riga azioni in alto a destra: pulsante primario (`Nuova Compagnia Assicurativa` / `Nuova Agenzia`) + pulsante `Reset filtri`.

### Blocco filtri (entrambi)
Stesso layout grid:
- Input `Cerca per nome / codice / sede` (full-width, con icona lente)
- Input `Codice iniziale` (largh. fissa)
- Toggle `Solo Plurimandatario` con badge contatore
- Bottone `Reset` a destra

### Tabella (uniformare colonne e ordini)
| Tab | Colonne richieste |
|---|---|
| Compagnie Assicurative | Codice · Nome · Tipo Mandatario · # Agenzie collegate · Plurimandataria · Stato · Azioni |
| Agenzie | Codice · Nome · Compagnia Assicurativa (gruppo) · Sede · Stato · Azioni |

Stesse classi tipografiche, stesso stile zebra, stesso menù azioni (Modifica · Elimina · in più sul tab Compagnie: "Vedi agenzie collegate"; sul tab Agenzie: "Vedi rapporti compagnia").

### Toast / messaggi errore
Verificare coerenza terminologica:
- Compagnia Assicurativa → entità di `gruppi_compagnia`
- Agenzia → entità di `compagnie`

---

## 3) Connessione Compagnia ↔ Agenzie (no hardcoding)

### Stato DB attuale (già presente, da non duplicare)
- `gruppi_compagnia` — anagrafica **Compagnia Assicurativa** (es. ALLIANZ).
- `compagnie` — anagrafica **Agenzia**, con FK `gruppo_compagnia_id` → relazione **1:N** "agenzia di default".
- `compagnia_rapporti` — tabella ponte **N:N** già esistente per **plurimandatarie**, con campi: `compagnia_id`, `gruppo_compagnia_id`, `codice_rapporto`, `tipo_rapporto`, `rami_abilitati[]`, `data_inizio`, `data_fine`, `attivo`, `percentuale_provvigione`, `iban_dedicato`, `referente_compagnia`, `email/telefono_referente`, `conto_bancario_id`, `note`.

Quindi **la struttura tabellare esiste già** e non è hardcoded: va solo esposta in UI in modo chiaro e usata in modo consistente.

### Cosa fare lato UI

#### A) Dal tab "Compagnie Assicurative"
- Per ogni riga, azione **"Agenzie collegate"** che apre il dialog esistente (`AgenzieCollegateDialog`) ma esteso a mostrare **due sezioni**:
  1. **Agenzia principale (1:N)** — agenzie con `compagnie.gruppo_compagnia_id = gruppo`. Solo lettura, link al dettaglio.
  2. **Rapporti aggiuntivi (N:N, plurimandatarie)** — righe da `compagnia_rapporti`. Tabella con: Agenzia · Codice rapporto · Tipo · Rami · Data inizio/fine · Attivo · Provvigione %. Pulsanti **Aggiungi rapporto**, **Modifica**, **Disattiva**.
- Il dialog "Aggiungi rapporto" usa `SearchableSelect` per scegliere l'Agenzia + form sui campi di `compagnia_rapporti`.

#### B) Dal tab "Agenzie" (dettaglio o azione "Rapporti compagnia")
- Riusare `RapportiCompagniaDialog` (già esistente in `src/components/compagnie/RapportiCompagniaDialog.tsx`) — verificarne i campi e allinearlo al medesimo modello di dati.
- Mostrare la **Compagnia Assicurativa principale** (FK `gruppo_compagnia_id`) come campo editabile via `SearchableSelect`, e sotto la lista dei **rapporti N:N** con la stessa griglia del punto A.

#### C) Validazioni
- `(compagnia_id, gruppo_compagnia_id, codice_rapporto)` deve essere unico per evitare duplicati. Se non esiste in DB un vincolo, aggiungerlo via migration:
  - `UNIQUE (compagnia_id, gruppo_compagnia_id, codice_rapporto)` su `compagnia_rapporti`.
- Trigger/RLS già coperti dal sistema esistente.

#### D) Conteggio "# Agenzie collegate"
- Calcolare lato query come `count(distinct compagnia_id)` unendo:
  - `compagnie` con `gruppo_compagnia_id = g.id`
  - `compagnia_rapporti` con `gruppo_compagnia_id = g.id AND attivo = true`
- Mostrarlo nella colonna del tab Compagnie Assicurative.

### Migrazione DB (minima, solo se serve)
Solo l'eventuale aggiunta del vincolo univoco; nessuna nuova tabella, nessun campo aggiunto.

---

## Dettagli tecnici

- File toccati principali:
  - `src/components/AppSidebar.tsx` (solo lettura per censimento)
  - `src/routes/*.tsx` (aggiunta route placeholder)
  - `src/pages/CompagnieList.tsx` (uniformità tab + uso del nuovo dialog)
  - `src/pages/CompagnieList.tsx` → `AgenzieCollegateDialog` esteso con sezione "Rapporti N:N"
  - `src/components/compagnie/RapportiCompagniaDialog.tsx` (allineamento form campi)
- Componenti riusati: `PlaceholderPage`, `SearchableSelect`, `Card`, `Table` (con stile zebra), `Dialog`.
- Migration eventuale: `ALTER TABLE public.compagnia_rapporti ADD CONSTRAINT compagnia_rapporti_unique UNIQUE (compagnia_id, gruppo_compagnia_id, codice_rapporto);` (solo se non già presente).

## Fuori scope
- Logica di business avanzata sui rapporti (workflow approvazione, storico versioni).
- Modifica delle entity di polizza che già usano `compagnia_id` / `gruppo_compagnia_id`.
- Implementazione reale delle pagine placeholder.

## QA manuale
1. Cliccando ogni voce della sidebar non si vede mai NotFound: o la pagina vera o un placeholder coerente.
2. I tab Compagnie Assicurative e Agenzie hanno header, filtri e tabella con la stessa anatomia.
3. Da una Compagnia Assicurativa è possibile vedere/aggiungere/modificare/disattivare un rapporto verso una Agenzia (plurimandataria) e il dato persiste in `compagnia_rapporti`.
4. Da una Agenzia si vede la Compagnia Assicurativa principale e l'elenco dei rapporti N:N.
5. La colonna "# Agenzie collegate" riflette sia i collegamenti 1:N che i rapporti N:N attivi.
