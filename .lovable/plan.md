# Obiettivo

Nella dialog "Nuovo / Modifica Rapporto" (`/compagnie` → Rapporti) il campo libero **"Rami abilitati (separati da virgola)"** è una stringa che non è collegata a nulla. Va sostituito con un selettore strutturato **Ramo (`gruppi_ramo`) + Sottoramo (`rami`)** coordinato (lo stesso pattern già usato in polizze: vedi memoria *ramo-sottoramo-coordinated-selection*) e persistito in una tabella ponte, così che la matrice provvigioni del rapporto possa proporre **solo** le combinazioni effettivamente abilitate.

## 1. Database — nuova tabella ponte

Tabella `compagnia_rapporto_rami`:
- `rapporto_id` → `compagnia_rapporti(id)` ON DELETE CASCADE
- `gruppo_ramo_id` → `gruppi_ramo(id)` (obbligatorio = "Ramo")
- `ramo_id` → `rami(id)` NULLABLE
  - se `NULL` ⇒ "tutto il gruppo ramo abilitato" (tutti i sottorami)
  - se valorizzato ⇒ solo quello specifico sottoramo
- UNIQUE `(rapporto_id, gruppo_ramo_id, COALESCE(ramo_id, '00000000-0000-0000-0000-000000000000'))`
- RLS: stesse policy lette/scritte da chi può gestire `compagnia_rapporti` (admin / livelli abilitati, allineato a quanto esiste oggi su `compagnia_rapporti`)

Vincolo applicativo + check: se `ramo_id` è valorizzato, il suo `gruppo_ramo_id` deve coincidere con quello della riga (trigger di coerenza).

Il vecchio campo `compagnia_rapporti.rami_abilitati` (text[]) resta in DB per retro-compatibilità ma non viene più letto/scritto dalla UI. Nessuna migrazione dati automatica: viene popolato a mano la prima volta che si apre/salva un rapporto.

## 2. Dialog Rapporto — UI

File: `src/components/compagnie/RapportiCompagniaDialog.tsx`

Sostituire l'attuale input testo `Rami abilitati` con una sezione **"Rami e Sottorami abilitati"**:

```text
[ + Aggiungi Ramo ]
┌──────────────────────────────────────────────┐
│ Ramo: [AUTO ▼]   Sottoramo: [Tutti ▼]   [✕] │
│ Ramo: [AUTO ▼]   Sottoramo: [RCA AUTO ▼] [✕]│
│ Ramo: [INFORTUNI ▼] Sottoramo: [Tutti ▼] [✕]│
└──────────────────────────────────────────────┘
```

- Ramo: SearchableSelect su `gruppi_ramo` (attivo=true).
- Sottoramo: SearchableSelect su `rami` filtrati per `gruppo_ramo_id` scelto, con opzione speciale **"Tutti i sottorami"** (= `ramo_id` NULL).
- De-duplica righe identiche; impedisci di mescolare "Tutti" + sottoramo specifico dello stesso gruppo (se l'utente sceglie "Tutti", rimuovi le righe specifiche di quel gruppo).
- In edit, precarica righe da `compagnia_rapporto_rami`.
- Su Salva: dopo l'upsert di `compagnia_rapporti`, fai `delete` + `insert` delle righe di `compagnia_rapporto_rami` per quel rapporto (in transazione lato client: delete-then-insert come già fatto altrove per relazioni N:N).

Riusa il pattern di `RamoSottoramoSelect` esistente se applicabile, oppure due `SearchableSelect` coordinati.

## 3. Matrice Provvigioni del rapporto

File: `src/components/compagnie/ProvvigioniRapportiTab.tsx`

Oggi la matrice Ramo × Sottoramo mostra **tutto** il catalogo. Modifica:
- Quando un rapporto è selezionato, carica `compagnia_rapporto_rami` per quel rapporto.
- Mostra come righe modificabili **solo** i `(gruppo_ramo, ramo)` abilitati:
  - se una riga abilitata ha `ramo_id = NULL`, espandila in N righe (una per ogni sottoramo del gruppo, dal catalogo `rami`).
  - se ha `ramo_id` specifico, mostra solo quella riga.
- Le percentuali continuano a salvarsi in `provvigioni_compagnia_ramo` (struttura già presente: `compagnia_rapporto_id`, `gruppo_ramo_id`, `ramo_id`, `percentuale_provvigione`).
- La catena di risoluzione resta invariata: Sottoramo → Ramo (default gruppo) → % Rapporto → Default Tipo Rapporto → 0%. L'unica differenza è che **non si può più impostare una % su un ramo non abilitato dal rapporto**.

Bottoni "Incolla CSV" e "Import IA": dopo il parsing, le righe per `(ramo, sottoramo)` non presenti tra quelle abilitate vengono mostrate in anteprima con badge "non abilitato" e l'utente può:
- scartarle, oppure
- aggiungerle ai rami abilitati del rapporto con un click ("Abilita e importa").

## 4. Fuori scope

- Nessuna modifica a polizze, titoli, calcolo provvigioni a valle.
- Nessuna migrazione automatica del vecchio `rami_abilitati` testo libero → la colonna resta in DB ma non più usata dalla UI.
- Nessuna modifica a `ProvvigioniCompagnieRamoPage` (pagina legacy).

## 5. Memoria

Aggiungere nota in `mem://insurance/compagnia-rapporti-multipli` (o nuova memoria `compagnia-rapporto-rami-abilitati`): i rami abilitati per rapporto vivono in `compagnia_rapporto_rami (rapporto_id, gruppo_ramo_id, ramo_id NULL=tutti)`; la matrice provvigioni e l'import IA/CSV si basano su questa tabella.
