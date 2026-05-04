## Obiettivo

Creare un **registro unico degli IBAN** dell'agenzia, eliminare gli hardcoded e dare a Sedi/Compagnie/Rapporti un puntatore al conto bancario master (con possibilità di override).

---

## 1) Nuova tabella master: `conti_bancari`

Tabella anagrafica unica per tutti gli IBAN aziendali (incassi clienti, conti compagnie, conti dedicati, conti contabili).

Colonne principali:
- `id uuid PK`
- `etichetta text NOT NULL` — es. "Conto incassi Napoli", "Conto Generali"
- `iban text NOT NULL UNIQUE` (uppercase, no spazi via trigger)
- `intestato_a text NOT NULL`
- `banca text` (nome banca: "Intesa Sanpaolo SpA")
- `bic text`, `codice_abi text`, `codice_cab text`, `citta_banca text`
- `tipo text NOT NULL` — `incasso_clienti` | `compagnia` | `provvigioni` | `generico`
- `is_default boolean DEFAULT false` — **un solo `is_default = true` per `tipo`** (constraint via unique partial index)
- `ufficio_id uuid REFERENCES uffici(id)` (NULL = valido per tutte le sedi)
- `piano_conti_conto_id uuid REFERENCES piano_conti_conti(id)` (collegamento opzionale al conto contabile)
- `attivo boolean DEFAULT true`, `note text`, timestamps

Trigger:
- normalizzazione IBAN (UPPER + rimozione spazi) prima di INSERT/UPDATE
- validazione lunghezza IBAN IT (27 char)

RLS: lettura per tutti gli autenticati; scrittura solo `admin` / `responsabile_sede`.

Seed iniziale (dai dati esistenti):
- Riga "Conto incassi default" con `IT70Q0306904214100000016469`, intestato "CONSULBROKERS DIGITAL SRL per conto compagnie", banca "Intesa Sanpaolo SpA", `tipo='incasso_clienti'`, `is_default=true`
- Una riga per ciascun conto già presente in `piano_conti_conti.iban` (Valsabbina, BCC Roma, Intesa Sanpaolo) con link a `piano_conti_conto_id`
- Una riga per ciascuna compagnia con IBAN valorizzato

---

## 2) Aggiunta riferimenti FK alle tabelle esistenti

- `uffici.conto_incasso_id uuid REFERENCES conti_bancari(id)` — IBAN su cui i clienti di quella sede pagano
- `compagnie.conto_bancario_id uuid REFERENCES conti_bancari(id)` — IBAN della compagnia per rimesse premi
- `compagnia_rapporti.conto_bancario_id uuid REFERENCES conti_bancari(id)` — override per singolo rapporto N:N (sostituisce `iban_dedicato`)

Le colonne testuali esistenti (`uffici.iban`, `uffici.intestato_a`, `uffici.banca`, `compagnie.iban`, ecc.) **restano in DB** per backward-compat ma vengono marcate come deprecate (commento) e l'UI smette di scriverle.

---

## 3) UI: gestione IBAN

### 3a) Nuova pagina "Conti Bancari"
Pagina CRUD `src/pages/anagrafiche/ContiBancariPage.tsx` accessibile da Anagrafiche → Conti Bancari (admin/responsabile_sede):
- Tabella zebra con etichetta, IBAN mascherato (`IT70 **** **** **** 6469`), intestato_a, banca, tipo, default, sede
- Filtro per tipo, switch "solo attivi"
- Dialog create/edit con validazione IBAN, toggle `is_default` per tipo
- Azione "Imposta come default" (gestita server-side per togliere default agli altri dello stesso tipo)

### 3b) `SediManager` — sezione "Coordinate bancarie"
Nel dialog di edit Sede aggiungere blocco con `SearchableSelect` su `conti_bancari` filtrato per `tipo='incasso_clienti'`, scrive `uffici.conto_incasso_id`. Mostra anteprima coordinate selezionate (intestato_a, banca, IBAN).

### 3c) `RapportiCompagniaDialog`
Sostituisce l'input testo `iban_dedicato` con `SearchableSelect` su `conti_bancari` (tipo `compagnia` o `generico`).

---

## 4) Risoluzione IBAN per E/C Cliente PDF

In `ECClientePdfPage` rimuovere l'hardcoded e usare questa cascata:

```text
1. uffici.conto_incasso_id (sede dell'operatore loggato)  → conti_bancari
2. fallback: conti_bancari WHERE tipo='incasso_clienti' AND is_default=true
3. fallback finale: errore visibile "Nessun IBAN configurato"
```

Idem per `ec-agenzia-pdf.ts` (per la compagnia: `compagnie.conto_bancario_id` → `conti_bancari`, fallback su master di tipo `compagnia`).

L'operatore può sempre **override manuale** prima di generare il PDF (input editabili come oggi), ma il default arriva dal master.

---

## 5) Default di sistema

- **Default globale incasso clienti**: 1 record `conti_bancari` con `tipo='incasso_clienti'` e `is_default=true` → usato quando la Sede dell'operatore non ha `conto_incasso_id`.
- **Default per compagnia**: ogni compagnia può avere il proprio `conto_bancario_id`; in mancanza, si usa il default `tipo='compagnia'`.
- Constraint via **unique partial index** `WHERE is_default = true` per ciascun `tipo`, così non si possono avere due default dello stesso tipo.

---

## 6) Migrazione dati esistenti

Script SQL one-shot:
1. INSERT del default incassi (IBAN Intesa hardcoded oggi)
2. INSERT da `piano_conti_conti` dove `iban IS NOT NULL` → popola `conti_bancari.piano_conti_conto_id`
3. INSERT da `compagnie` dove `iban IS NOT NULL` → set `compagnie.conto_bancario_id`
4. INSERT da `compagnia_rapporti.iban_dedicato` dove valorizzato → set `compagnia_rapporti.conto_bancario_id`
5. Per `uffici`: lasciare `conto_incasso_id = NULL` (useranno il default), oppure se `uffici.iban` valorizzato creare riga e linkare

---

## File toccati

**Migrazioni DB**
- nuova tabella `conti_bancari` + trigger normalizzazione + RLS
- ALTER su `uffici`, `compagnie`, `compagnia_rapporti` per aggiungere FK
- seed dati iniziali

**Frontend nuovo**
- `src/pages/anagrafiche/ContiBancariPage.tsx`
- `src/components/anagrafiche/ContoBancarioSelect.tsx` (componente riusabile)
- nuova route + voce sidebar in Anagrafiche

**Frontend modificato**
- `src/components/anagrafiche/SediManager.tsx` — aggiunge selettore conto incassi
- `src/components/compagnie/RapportiCompagniaDialog.tsx` — switch da text a select master
- `src/pages/contabilita/ECClientePdfPage.tsx` — risoluzione IBAN da master, no hardcoded
- `src/lib/ec-cliente-pdf.ts` — accetta intestato/banca/IBAN dal chiamante (già fa così)
- `src/pages/contabilita/ECAgenziaPdfPage.tsx` + `src/lib/ec-agenzia-pdf.ts` — uso master per IBAN compagnia

---

## Note / fuori scope

- Il portale cliente (`ClientePagamenti.tsx`) **non viene toccato ora**: oggi non mostra IBAN. Se vuoi che il cliente veda l'IBAN dell'agenzia direttamente nel portale, lo aggiungiamo come step successivo (basta leggere lo stesso master).
- I campi testuali deprecati (`uffici.iban`, ecc.) restano in DB per non rompere eventuali letture residue; verranno rimossi in una migrazione successiva dopo verifica.
- Validazione checksum IBAN IT completa (mod 97): inclusa nel trigger come check formato base; checksum completo opzionale, ditemi se lo vuoi attivo.

Procedo con l'implementazione?
