## Obiettivo
In `ImmissionePolizzaPage`, affiancare Ramo e Sottoramo nella card "Contratto" (sottoramo subito sotto al ramo) e usare il Sottoramo scelto come **default** per le righe di Composizione Premio (Firma + Quietanza), pur restando modificabile per riga.

## Modifiche

### 1. Card "Contratto" — Ramo + Sottoramo vicini
File: `src/pages/ImmissionePolizzaPage.tsx` (righe ~2181-2216).

- Sostituire `<RamoSottoramoSelect gruppoOnly ... />` con `<RamoSottoramoSelect layout="stacked" gruppoRamoId={selectedGruppoRamoId} ramoId={defaultSottoramoId} onChange={...} />` (rimosso `gruppoOnly`, aggiunto `layout="stacked"` per impilare verticalmente).
- L'`onChange` aggiorna sia `selectedGruppoRamoId` sia un nuovo stato `defaultSottoramoId`.
- Cambio di Ramo → reset righe garanzia (logica conferma già esistente) + `defaultSottoramoId = null`.
- Cambio di solo Sottoramo (stesso ramo) → **propagare** il nuovo sottoramo alle righe garanzia che sono ancora "vuote" (nessun netto/tasse) o che hanno lo stesso vecchio default. Le righe già compilate manualmente con un sottoramo diverso restano intatte.
- Aggiornare il testo helper: "Sottoramo di default; puoi modificarlo riga per riga nelle Composizioni Premio sotto."

### 2. Nuovo stato `defaultSottoramoId`
- `const [defaultSottoramoId, setDefaultSottoramoId] = useState<string | null>(null);`
- Aggiornare la helper `emptyGaranziaRow()` (o i punti dove si crea una nuova riga "+") perché preimposti `sottoramoId = defaultSottoramoId` e relativi `codice`/`descrizione`/`aliquotaTasse` derivati da `ramiList`.

### 3. Bottoni "Aggiungi riga" Firma/Quietanza
- Quando si clicca "+", la nuova riga eredita `defaultSottoramoId` (e i campi correlati: codice, descrizione, aliquota tasse dal record `rami`).
- Se `defaultSottoramoId` è vuoto, comportamento attuale invariato.

### 4. Inizializzazione su modifica esistente / import AI / rinnovo
- Quando si caricano righe esistenti (es. madre polizza, AI, rinnovo) e tutte le righe usano lo stesso sottoramo, impostare `defaultSottoramoId` con quel valore così la UI Contratto resta coerente.

### 5. Salvataggio
- Nessun cambiamento sul DB: `titoli.ramo_id` continua a derivare dalla prima riga garanzia non vuota (come già fatto). Il `defaultSottoramoId` è solo stato UI.

## Fuori scopo
- `TitoloDetail` (modifica polizza esistente): nessuna modifica in questo passaggio.
- Nessuna migration DB.
- Logica provvigioni / RCA / sezioni veicolo: invariate.
