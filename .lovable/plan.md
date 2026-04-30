## Obiettivo

Eliminare il selettore "Tipo intermediario" e mostrare un'**unica lista combinata** (Account Executive + Specialist + Produttori) nel `SearchableSelect` con ricerca. Alla selezione, capire automaticamente la fonte e popolare i campi RUI correttamente.

## Modifiche a `src/pages/DocPrecontrattualePage.tsx`

### 1. Rimuovere il selettore "Tipo intermediario"
Eliminare il `<select>` "Tipo intermediario" (UI) e lo state `tipoIntermediario` + il tipo `TipoIntermediario`. Mantenere solo `intermediario` (id selezionato).

### 2. Lista unica combinata
Sostituire `intermediarioOptions` con un'unica lista che mette insieme i tre dataset, ordinata per cognome. Per sapere da quale tabella leggere al momento della selezione, ogni `value` viene **prefissato con l'origine**:
- `ae:<id>` → record da `anagrafiche_professionali` (Account Executive)
- `sp:<id>` → record da `profiles` (Specialist/Backoffice)
- `pr:<id>` → record da `anagrafiche_professionali` (Produttore)

Il prefisso non è visibile all'utente (vede solo Cognome Nome + email come description).

### 3. `applyIntermediario(id)` legge il prefisso
- `id.split(":")` → `[origin, realId]`
- Se `origin === "sp"` → cerca in `specialistList`, formatta `data_iscrizione_rui` come data IT
- Altrimenti → cerca in `aeList` o `produttoreList`, usa il campo testuale `iscrizione_rui`
- Popola gli stessi 10 campi RUI (Nome, Sezione, Numero, Data, Indirizzo, CAP, Città, Prov, Email, Tel)

### 4. Prefill da cliente
Nel `useEffect` che popola da `prefillData`, sostituire `setIntermediario(specialist.id)` con `setIntermediario(\`sp:${specialist.id}\`)` per restare coerente con il nuovo schema.

### 5. Bump versione
`public/version.json` → nuovo timestamp.

## Cosa NON cambia
- Le 3 query (`aeList`, `specialistList`, `produttoreList`) restano: servono come sorgenti dati
- Il PDF e `buildData()` non cambiano (usano gli state `nomeCognomeRui`, `sezioneRui`, ecc.)
- Nessuna modifica DB

## File modificati
- `src/pages/DocPrecontrattualePage.tsx`
- `public/version.json`
