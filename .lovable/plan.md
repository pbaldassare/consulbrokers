# Unificazione Filiali → Sedi

## Stato attuale
- `uffici` (Sedi) — 2 record: `001 Ufficio di Napoli`, `SDO SEDE SAN DONA' DI PIAVE`. Gestita da `Gestione Sedi`.
- `filiali` — 18 record, tutti già concettualmente "sedi/uffici" (es. `UF-BER Ufficio di Bergamo`, `SEDE`, `FIL1`, `AMB-DEMO`...).
- Campi text liberi (NON FK):
  - `titoli.filiale` — 1043 righe valorizzate, 3 valori distinti
  - `codici_commerciali_cliente.filiale` — 543 righe, 20 valori distinti (in gran parte testo libero tipo nomi broker o "SEDE NAPOLI", non collegati a `filiali`).
- UI che cita "filiale": `TabelleBasePage` (sezione lookup), `ClientiList`, `ClienteDetail`, `RinnoviPolizzaPage` (filtro), `DocPrecontrattualePage` (option in select tipo riferimento).

## Decisione
Filiale = Sede. Si tiene **una sola** entità (`uffici`/Sedi). Si rimuove la voce **Filiali** da Tabelle Base e dall'UI clienti/rinnovi. I dati `filiali` non collegati a UI funzionali (i campi text non sono FK) restano inerti in DB ma non più gestiti.

## Modifiche

### 1. Tabelle Base — rimuovere voce "Filiali"
`src/pages/TabelleBasePage.tsx` linea 1038: eliminare la riga `{ value: "filiali", ... }` dall'elenco lookup. Voce non più visibile nel selettore di Tabelle Base.

### 2. Anagrafica cliente — rimuovere campo "Filiale"
`src/pages/ClienteDetail.tsx`:
- Rimuovere state `filiale` (linea 429), reset (443), invio in payload (462), Label+Input (499-500).

`src/pages/ClientiList.tsx` (sub-form ruoli commerciali):
- Rimuovere `filiale` dall'interfaccia ruolo (32), default (46), payload insert (394), Label+Input (572-573).

NB: il campo `codici_commerciali_cliente.filiale` resta in DB (storico), ma non più editabile da UI.

### 3. Rinnovi — rimuovere filtro "Filiale"
`src/pages/RinnoviPolizzaPage.tsx`: rimuovere state `filiale` (22), Label+select (127-129) e ogni riferimento a `filiale` nel filtro query.

### 4. DocPrecontrattualePage
`src/pages/DocPrecontrattualePage.tsx` linea 252: la option `<option value="Filiale">Filiale</option>` è il *tipo riferimento* del documento (Sede/Filiale/Agenzia). Dato che ora Filiale ≡ Sede, **rimuovere** l'option "Filiale" lasciando "Sede".

### 5. Sidebar / navigazione
Verificare in `AppSidebar.tsx` che non esista una voce "Filiali" separata; se presente, rimuoverla (Gestione Sedi è già l'unica entry).

### 6. Database (nessuna distruzione dati)
- **NON** droppare la tabella `filiali` né le colonne `filiale` su `titoli`/`codici_commerciali_cliente` per preservare lo storico.
- Migrazione ottimale: nessuna. Si lascia tutto inerte. (Se in futuro si vorrà fare cleanup, faremo una migrazione separata di archiviazione.)

### 7. Memoria
Aggiornare `mem://insurance/...` con nota: "Filiali unificate dentro Sedi (`uffici`). Tabella `filiali` deprecata, mantenuta solo per storico — non esporre in UI."

## File toccati
- `src/pages/TabelleBasePage.tsx`
- `src/pages/ClienteDetail.tsx`
- `src/pages/ClientiList.tsx`
- `src/pages/RinnoviPolizzaPage.tsx`
- `src/pages/DocPrecontrattualePage.tsx`
- `src/components/AppSidebar.tsx` (solo se contiene voce Filiali)
- nuova memoria di deprecazione

## Note / domande
- I 18 record di `filiali` (es. "Ufficio di Bergamo", "Ufficio Cauzioni") **non** sono presenti tra le 2 Sedi di `uffici`. Vuoi che li **migri come nuove Sedi** in `uffici` (insert dei 18 record) oppure restano semplicemente storici e non più gestiti? Default proposto: **non migrare** (le Sedi reali sono solo 2; gli altri sembrano dati di test/legacy). Confermi?
