## Cosa ho capito

Oggi le provvigioni vivono in **due posti**:
- **Pagina legacy** `/provvigioni-compagnie-ramo` → lista piatta basata su `categorie_prodotto` (un'unica % per coppia compagnia+categoria, **senza distinzione di Rapporto**).
- **Tab "Provvigioni" nel dialog Rapporti** (`ProvvigioniRapportiTab`) → matrice corretta **Rapporto → Ramo (gruppo) → Sottoramo**, su `provvigioni_compagnia_ramo (compagnia_rapporto_id, gruppo_ramo_id, ramo_id)`, già con Incolla CSV / Copia da altro / Import IA / Export, e catena di risoluzione a 5 livelli.

Devo **unificare tutto sulla seconda logica** (per Rapporto) e renderla la **pagina ufficiale** delle provvigioni compagnie, con i tre canali di inserimento (manuale, IA, CSV) ben visibili in un unico posto.

## Esempi per validare la comprensione

### Esempio 1 — NOBIS (Agenzia, rapporto "nobis verona — etisicura test")
Rami abilitati sul rapporto: AUTO, ARD, CRISTALLI, INFORTUNI.
Inserisco a mano:
- AUTO → default ramo **12%**, sottoramo R.C.A. **14%**, sottoramo LIBRO MATRICOLA **10%** → polizza RCA usa 14, polizza Libro Matricola usa 10, qualunque altro sottoramo AUTO eredita 12.
- ARD → default ramo **18%** (nessun override) → tutti i sottorami ARD ereditano 18.
- CRISTALLI → nessun valore → in immissione polizza si scende al livello successivo (% globale rapporto → default tipo "Agenzia" → 0% con warning).

### Esempio 2 — ALLIANZ Direzione (broker, listino fornito in PDF)
1. Apro la pagina, seleziono il rapporto "Allianz — Direzione Milano".
2. Click **Import IA**, carico il PDF del tariffario → l'IA torna righe `{ramo, sottoramo, %}` mappate su `gruppi_ramo` + `rami` con anteprima e match score; confermo → upsert in `provvigioni_compagnia_ramo` solo per i Rami abilitati sul rapporto.
3. Per qualche sottoramo nuovo arriva un Excel del referente: copio le 3 colonne, click **Incolla CSV**, parser riconosce `ramo;sottoramo;%`, mostra anteprima con conflitti (giallo = sovrascrive), confermo.
4. Per un nuovo rapporto "Allianz — Direzione Roma" simile: **Copia da altro** → seleziono "Milano" → copia tutte le righe in un colpo, poi ritocco a mano le differenze.

Se in entrambi gli esempi mancano del tutto regole per un certo Ramo×Sottoramo, la polizza scende lungo la **catena di risoluzione**: match esatto → default ramo del rapporto → % globale del rapporto (`compagnia_rapporti.percentuale_provvigione`) → default per Tipo rapporto (`provvigioni_default_tipo`) → 0% + warning.

## Modifiche proposte

### 1. Pagina `/provvigioni-compagnie-ramo` rifatta
Sostituire il contenuto attuale con il componente già esistente **`ProvvigioniRapportiTab`** (che è già una vista completa: selettore rapporto + 3 azioni IA/CSV/Copia + matrice Ramo/Sottoramo + Export + Default per tipo rapporto in accordion).
Aggiungere sopra:
- **Filtri rapporto** (compagnia madre, tipo, ricerca testo) per facilitare la scelta su liste lunghe.
- Banner riassuntivo con conteggi: "X rapporti — Y con provvigioni configurate — Z senza nessuna regola".
- Pulsante **"Vai al rapporto"** che apre lo stesso dialog rapporti della pagina Compagnie (per modificare Rami abilitati / IBAN se servono).

### 2. Allineamento dati legacy
- La tabella `provvigioni_compagnia_ramo` ha già le colonne giuste (`compagnia_rapporto_id`, `gruppo_ramo_id`, `ramo_id`).
- Le righe storiche basate su `categoria_id` (vecchia pagina) restano lette in sola lettura in un accordion "Regole legacy per categoria prodotto" con bottone **"Migra a Ramo/Sottoramo"** (mappa manuale 1 a 1, l'utente conferma il `gruppo_ramo_id` / `ramo_id` corrispondente, poi disattiva la riga legacy).
- Nessun DROP di colonne in questo step: solo nascondere `categoria_id` dalla UI di inserimento.

### 3. Import CSV potenziato
Il PasteDialog attuale accetta solo incolla testuale. Aggiungere accanto al pulsante **"Incolla CSV"** un pulsante **"Carica CSV"** con `<input type=file>`:
- Header atteso: `ramo;sottoramo;percentuale` (sottoramo vuoto = default ramo).
- Parser tollerante (`,` o `;`, `.` o `,` come decimale).
- Anteprima con badge per ogni riga: ✓ nuovo · ⟳ aggiorna · ⚠ ramo non abilitato sul rapporto (skip) · ✗ ramo/sottoramo non trovato.
- Conferma → stessa `upsertMutation` già esistente.

### 4. Import IA — refinement
`AiImportDialog` esiste già. Verificare che:
- L'edge function `parse-tariffario-rami` (o equivalente esistente) torni anche `gruppo_ramo_id` risolto, non solo testo.
- Nella UI mostriamo match score e permettiamo override manuale del Ramo/Sottoramo riga per riga prima del salvataggio.
- Filtraggio automatico delle righe su Rami non abilitati sul rapporto (con elenco "saltati" visibile).

### 5. Collegamento all'immissione polizza
In `ImmissionePolizzaPage` la lookup % deve seguire la catena di risoluzione (1→5). Verificare/aggiungere helper `resolvePercentualeProvvigione({ compagnia_rapporto_id, gruppo_ramo_id, ramo_id, tipo_rapporto })` riusabile, con `console.warn` + toast info quando ricade su step 5 (0% + warning).

### 6. Sidebar
La voce "Provvigioni Compagnie/Ramo" resta dov'è (gruppo Provvigioni). Cambia solo il contenuto della pagina.

## Dettagli tecnici

- **Tabelle coinvolte (già esistenti)**: `compagnia_rapporti`, `compagnia_rapporto_rami`, `provvigioni_compagnia_ramo`, `provvigioni_default_tipo`, `gruppi_ramo`, `rami`.
- **Nessuna migration strutturale** richiesta in questo step. Eventuale soft-delete delle righe legacy (`categoria_id IS NOT NULL`) solo dopo migrazione confermata.
- **File da modificare**:
  - `src/pages/ProvvigioniCompagnieRamoPage.tsx` → rifatto attorno a `ProvvigioniRapportiTab` + filtri + accordion legacy.
  - `src/components/compagnie/ProvvigioniRapportiTab.tsx` → aggiunta "Carica CSV file", refinement AI dialog.
  - `src/components/compagnie/PasteDialog` (interno) → supporto file upload.
  - `src/pages/ImmissionePolizzaPage.tsx` + nuovo helper `src/lib/resolveProvvigione.ts` → catena di risoluzione.
- **Fuori scope**: rifacimento UI del dialog Rapporti, modifiche a `produttori_provvigioni_ramo` (sistema parallelo per Produttori), modifiche schema DB.

Confermami se gli esempi rispecchiano quello che vuoi, oppure dimmi cosa correggere (es. priorità diverse nella catena, formato CSV diverso, comportamento "Rami non abilitati" da bloccare invece di skippare).
