## Problema

Nello step "Importi" di Immissione Polizza (sezione **Premi per Garanzia — Firma / Quietanza**) puoi inserire **una sola riga di garanzia** e, per i rami non-RCA, la tendina mostra spesso **una sola voce** (es. `MAL — Malattia` per il gruppo ZM). Risultato: non riesci ad articolare più garanzie/sotto-voci sotto un sottoramo come faresti dopo aver salvato la polizza (dove `VociRcaCard` consente più righe con "Aggiungi voce").

Cause individuate:
- `PremiGaranziaCardShell` è single-row by design (un solo `SearchableSelect` + un solo `Input` netto/tasse).
- Il catalogo `rca_garanzie` contiene 1 sola riga per ogni `gruppo_ramo_id` non-RCA (verificato: ZM, ZN, ZP, ZL, ZS, ZT, ZV, ZY, ZD, ZC, DI hanno tutti 1 garanzia; solo ZQ-RCA ne ha 18).
- Nessun pulsante "Aggiungi voce" e niente persistenza di righe multiple per non-RCA in `premi_garanzia_polizza` (l'insert al rigo ~596 si attiva solo dal vecchio blocco RCA `premiGaranzia`).

## Cosa costruire

### 1. `PremiGaranziaCardShell.tsx` — multi-row come `VociRcaCard`

Trasforma la card da single-row a tabella con N righe + totali in fondo:

- Props nuove:
  - `rows: GaranziaRow[]` con `onRowsChange(next: GaranziaRow[]) => void`
  - `GaranziaRow = { codice: string | null; descrizione: string; netto: string; tasse: string; aliquotaTasse: number }`
  - `addizionali`/`onAddizionaliChange` rimangono a livello card (totale).
- UI per ogni riga: `SearchableSelect` (catalogo filtrato per `gruppoRamoId`) **+ campo testo libero** se il catalogo restituisce ≤1 voce, così l'utente può aggiungere righe nominandole liberamente (es. "Day Hospital", "Diaria"). Fallback gestito via flag `allowFreeText = catalogo.length <= 1`.
- Pulsante `+ Aggiungi voce` in fondo alla tabella (stile `VociRcaCard`).
- Pulsante "rimuovi riga" (icona Trash) per ogni riga, con conferma solo se non vuota.
- Ricalcolo automatico tasse della riga al cambio garanzia: `netto * aliquotaTasse / 100`.
- Riga totale (in fondo): somma `netto`, somma `tasse`, `addizionali` editabile, `lordo = Σ netto + Σ tasse + addizionali`.
- Provvigioni footer rimane invariato (somma globale calcolata fuori).

### 2. `ImmissionePolizzaPage.tsx` — state + persistenza

- Sostituisci gli scalari `premioNetto/tasse` (e gli equivalenti Quietanza) con due array di righe:
  - `premiFirma: GaranziaRow[]`, default `[{ codice: null, descrizione: "", netto: "", tasse: "", aliquotaTasse: 0 }]`
  - `premiQuietanza: GaranziaRow[]` con stesso default; bottone "Sincronizza da Firma" (icona) per copiare l'array.
- Calcoli derivati `premioNetto = Σ netto`, `tasse = Σ tasse`, `lordo`, già passati alle altre sezioni che li leggono (verificare e adattare i punti che usano `premioNetto`/`tasse` per "Provvigioni Firma/Quietanza" e "Importi totali").
- Salvataggio:
  - Persisti **tutte** le righe Firma in `premi_garanzia_polizza` (oltre al ramo RCA). Estendi l'insert al ~rigo 596 a non-RCA usando `premiFirma`. Mappa: `garanzia = codice ?? descrizione`, `firma = netto`, `tasse = tasse`, `ordine = idx`.
  - Persisti anche le righe Quietanza? Schema attuale `premi_garanzia_polizza` non distingue Firma/Quietanza: aggiungi colonna **`tipo_premio text NOT NULL DEFAULT 'firma' CHECK IN ('firma','quietanza')`** e inserisci entrambi i set marcati.
  - Persisti `addizionali` e `addizionali_quietanza` su `titoli` (campi già presenti).
- Rimuovi il vecchio blocco `<PolizzaSection title="Premi per Garanzia">` RCA al rigo 1300 (legacy duplicato): le sue righe confluiscono nel nuovo multi-row Firma quando `isRCA`.

### 3. Migrazione DB

- `ALTER TABLE premi_garanzia_polizza ADD COLUMN tipo_premio text NOT NULL DEFAULT 'firma' CHECK (tipo_premio IN ('firma','quietanza'));`
- Backfill: lasciare i record esistenti a `'firma'` (default già lo fa).
- Aggiorna `VociRcaCard` (già usata in `TitoloDetail`) per leggere/filtrare per `tipo_premio` quando rilevante — fuori scope se non rompe la UI esistente; verificare con una lettura mirata e adattare solo se rompe.

### 4. Test

Aggiungi a `src/components/polizze/__tests__/`:
- `premiGaranziaShell.test.ts`: aggiunta riga, rimozione riga, free-text quando catalogo ≤1, ricalcolo tasse al cambio garanzia, totali.
- `immissionePolizzaPremi.test.ts` (logica pura, senza render): mapping array Firma+Quietanza → payload `premi_garanzia_polizza` con `tipo_premio` corretto e `ordine` incrementale.

## Fuori scope

- Riempire/estendere il catalogo `rca_garanzie` per i rami non-RCA (richiede dato business — l'utente può aggiungere voci a mano via free-text intanto).
- Refactor di `VociRcaCard` (resta com'è in TitoloDetail).
- AI import multi-garanzia (un follow-up separato).
