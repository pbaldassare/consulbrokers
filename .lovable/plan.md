## Miglioramenti pagina Gestione Polizze

Estendo la pagina `GestionePolizzePage` con permessi UI, log attività, paginazione/ordinamento, filtri avanzati e un test E2E Playwright che copre tutte le 12 operazioni.

### 1. Permessi UI (admin-only e blocchi)

- Le card delle operazioni admin-only (`Annulla Polizza`, `Annulla Messa a Cassa`) si **nascondono** se l'utente non è admin (`isAdmin` da `AuthContext`).
- Le card che richiedono il permesso `titoli` vengono **disabilitate** (grigio + tooltip "Permesso mancante") se `hasPermission('titoli')` è falso, invece di sparire — così l'utente capisce che esistono.
- Stesso check ripetuto sui pulsanti "Esegui" dentro i dialog risultato, per evitare bypass via deep link.

### 2. Sezione "Attività recenti" per operazione

Sotto la lista delle polizze filtrate, aggiungo un pannello collassabile "Ultime attività" che mostra:
- ultimi 10 record da `log_attivita` filtrati per `tipo_oggetto = 'titolo'` e per `azione` correlata all'operazione selezionata (es. `appendice_creata`, `storno_eseguito`, `messa_cassa`, ecc.);
- colonne: data/ora, utente, polizza (N°), descrizione;
- click su riga → naviga a `/titoli/:id?tab=log`.

Query con `useQuery`, `limit(10)`, ordinata `created_at desc`.

### 3. Paginazione + ordinamento lista polizze

- Sostituisco il fetch attuale con `useServerPagination` (limite **25**, debounce **350ms**) per rispettare le convenzioni di progetto.
- Aggiungo controlli di ordinamento sulle colonne **N° Polizza** e **Decorrenza/Scadenza** (toggle asc/desc cliccando l'header) — passati alla query come `.order(...)`.
- Footer paginazione: "Pagina X di Y · totale Z" + bottoni Precedente/Successivo.

### 4. Filtri avanzati con SearchableSelect

Sostituisco gli input testo correnti con `SearchableSelect` (Popover + Command) per:
- **Cliente** → fetch da `clienti` (ragione_sociale/nome+cognome), debounced server-side;
- **Compagnia** → fetch da `compagnie` attive;
- **N° Polizza** → resta input testo (libero) ma con suggerimenti dai titoli matchanti (autocomplete);
- mantengo i filtri esistenti **Stato** e **Range Decorrenza**.

I filtri sono pre-impostati per operazione (es. Sospensione → solo `stato=attivo`) e poi raffinabili dall'utente.

### 5. Test Playwright E2E

Nuovo file `e2e/gestione-polizze.spec.ts` (o sotto `tests/e2e/` se già presente) che, **per ognuna delle 12 operazioni**:

1. login con utente admin di test (env `TEST_USER`/`TEST_PASS`),
2. naviga a `/portafoglio/gestione`,
3. clicca la card operazione,
4. applica filtro cliente noto (dataset di test) + seleziona la prima polizza valida,
5. compila i **campi obbligatori minimi** del dialog/route target,
6. salva,
7. verifica toast di successo + presenza nuova riga in `log_attivita` (via UI nel tab Log della polizza).

Operazioni che navigano a pagine esterne (`Appendice`, `Rinnovo`, `Precontrattuale`, `Duplica`) vengono verificate aprendo la pagina target e completando il form minimo.

Aggiungo script `bun run test:e2e:gestione` in `package.json` per eseguire solo questo spec.

### Sezione tecnica

**File nuovi**
- `src/components/polizze/azioni/AttivitaRecentiPanel.tsx` — pannello log attività per operazione.
- `tests/e2e/gestione-polizze.spec.ts` — test E2E delle 12 operazioni.

**File modificati**
- `src/pages/GestionePolizzePage.tsx`:
  - integra `isAdmin` / `hasPermission` da `useAuth` per nascondere/disabilitare le card;
  - sostituisce fetch manuale con `useServerPagination`;
  - aggiunge ordinamento header-click su `numero_polizza` e `decorrenza`;
  - sostituisce input cliente/compagnia con `SearchableSelect`;
  - integra `<AttivitaRecentiPanel operationKey={selectedOp} />`.
- `package.json` — script `test:e2e:gestione`.

**Nessuna modifica DB / RLS / trigger.** Riuso `log_attivita`, `useServerPagination`, `SearchableSelect`, dialog esistenti.

**Permessi → operazioni**
| Operazione | Visibile a | Eseguibile se |
|---|---|---|
| Appendice, Storno, Rinnovo, Duplica, Sostituzione, Sospensione, Riattivazione, Messa a Cassa, Carica Documenti, Precontrattuale | tutti | `hasPermission('titoli')` |
| Annulla Polizza, Annulla Messa a Cassa | solo `isAdmin` | `isAdmin` |
