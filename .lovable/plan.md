# Pulizia & ottimizzazione progetto — piano in 5 step

Lavoro **incrementale e sicuro**: nessun cambio di funzionalità, route, schema DB, ruoli/RLS o stile grafico. Ogni step è una PR logica separata, verificabile in preview prima di passare al successivo.

---

## Step 1 — Analisi e report (no code change)

Produco un documento `.lovable/audit-refactor.md` con:

**1.1 Pagine più pesanti (LOC)**
```
TitoloDetail.tsx              3285
ClienteDetail.tsx             2034
CompagnieList.tsx             1454
ImmissionePolizzaPage.tsx     1267
ClientiList.tsx               1178
TabelleBasePage.tsx           1114
AreaCFO.tsx                   1083
BandiPubbliciPage.tsx         1031
AnagraficheInternePage.tsx    1027
DocPrecontrattualePage.tsx     914
AnagraficheCompagniePage.tsx   883
```

**1.2 Componenti grossi**
```
polizze/VociRcaCard.tsx          1294
clienti/NuovoClienteDialog.tsx    871
anagrafiche/SpecialistList.tsx    773
chat/NuovaConversazioneDialog    714
polizze/RinnovoTitoloDialog.tsx   652
AddressAutocomplete.tsx           587
anagrafiche/SediManager.tsx       565
compagnie/RapportiCompagniaDialog 460
```

**1.3 Pagine con troppi dati misti** (candidate a split in tab/sezioni)
- `TitoloDetail` — anagrafica + tecnico + provvigioni + movimenti + appendici + log nello stesso file
- `ClienteDetail` — anagrafica + polizze + sinistri + documenti + comunicazioni
- `AreaCFO` — KPI + grafici + drill-down + AI chat
- `CompagnieList` — lista + dialog rapporti + branch + tax in un solo file

**1.4 Duplicazioni rilevate (da verificare in step 2)**
- pattern `formatCurrency` / `Intl.NumberFormat('it-IT', currency:'EUR')` ripetuto in molti file → già esiste `src/lib/formatCurrency.ts`, va centralizzato l'uso
- date format `it-IT` ripetuto → estrarre in `lib/formatDate.ts`
- pattern paginazione client-side (`PAGE_SIZE`, `setPage(0)` su filtri) duplicato in pagine Provvigioni, Portafoglio, EC* → estrarre `usePagination` hook
- pattern lookup tables (rami/compagnie/produttori/clienti) ripetuto → consolidare in `useLookupTables` (esiste già, ma non sempre usato)
- skeleton/loading state duplicati → già parzialmente in `ProvvigioniSkeletons`, generalizzare in `components/ui/skeletons/`
- query Supabase con stesso shape per "lista clienti", "lista compagnie" presenti in più pagine → custom hook

**1.5 Stati React ridondanti (da analizzare puntualmente)**
- pagine grandi con 15+ `useState` invece di `useReducer` o `react-hook-form`
- filtri ricalcolati ad ogni render senza `useMemo`

**1.6 Codice morto sospetto** (da confermare con doppio check, NON rimosso senza verifica)
- `pages/GestioneUtenti.tsx` (sostituita da `GestioneUtentiPrivilegi`?)
- `BancaImport.tsx`, `FornitoriPage.tsx` (rotte redirectano altrove in `routes/sistema.tsx`)
- TODO marker in `DuplicazionePolizzaPage`, `DiffProvvigioniPage`, `ConfermaEmittendePage`, `StornoPolizzaPage`

**1.7 Performance**
- nessun `console.log` residuo (già pulito ✓)
- mancano `React.memo`/`useMemo` su tabelle grandi (TitoliList, PortafoglioList, ClientiList)
- alcune query non usano `select` puntuale e tirano colonne extra

**Output Step 1 = solo il file `audit-refactor.md`**, niente modifiche.

---

## Step 2 — Pulizie sicure (basso rischio)

- `eslint --fix` su tutto `src/` (import order, unused vars segnalati)
- Rimozione import inutilizzati e variabili dichiarate-mai-usate (uno per file, verifica build)
- Rimozione codice commentato vecchio
- Sostituzione `Intl.NumberFormat` ripetuti con `formatCurrency` da `src/lib/formatCurrency.ts`
- Aggiunta `formatDate` helper + sostituzione formatter date sparsi
- **Non** rimuovo file sospetti di essere morti: li elenco nel report con istruzioni di verifica manuale

Verifica: build pulita, preview identica.

---

## Step 3 — Refactor componenti grandi (top 5)

Per ciascuno: split in sotto-componenti nella stessa cartella, **stessa UI, stessi props pubblici**.

1. **TitoloDetail.tsx (3285 LOC)** → `titolo/` 
   - `TitoloHeader`, `TitoloAnagraficaTab`, `TitoloTecnicoTab`, `TitoloProvvigioniTab`, `TitoloMovimentiTab`, `TitoloAppendiciTab`, `TitoloLogTab` + hook `useTitoloData`
2. **ClienteDetail.tsx (2034)** → `cliente/detail/` con tab già esistenti come componenti
3. **CompagnieList.tsx (1454)** → estrarre `CompagniaRow`, `CompagnieFilters`, `CompagnieTable`
4. **VociRcaCard.tsx (1294)** → split per gruppo voci (RCA / ARD / Garanzie)
5. **ImmissionePolizzaPage.tsx (1267)** → step già logici, separare in `immissione/StepX.tsx`

Ogni refactor: 1 commit per file, verifica preview prima del successivo.

---

## Step 4 — Organizzazione dati nelle pagine dense

- `AreaCFO`: dividere in sezioni con titoli (KPI / Andamento / Drill-down / AI), già parziale
- `ClientiList` / `ProspectList`: raggruppare colonne con header secondari, ridurre densità
- `TabelleBasePage`: separare le tab in file dedicati
- Migliorare spaziatura/typography seguendo i token esistenti (no nuovi colori)

---

## Step 5 — Verifica finale

- Build TypeScript pulita
- Smoke test manuale guidato (lista pagine principali in preview)
- Report finale con: file modificati, LOC ridotte, componenti estratti, helper centralizzati, file morti **solo segnalati** (non rimossi senza tua conferma)

---

## Regole rispettate

- Nessuna modifica a: route, schema DB, RLS, auth, nomi campi, librerie nuove
- Nessuna rimozione di funzionalità
- Stile grafico invariato (token esistenti)
- Refactor solo per leggibilità/manutenibilità

## Cosa NON farò senza tuo OK esplicito

- Eliminare file sospetti come morti
- Introdurre nuove librerie (es. zustand, react-query refactor)
- Convertire pagine a `react-hook-form` se oggi usano `useState`
- Cambiare strategia di data fetching (oggi: supabase-js diretto)

Confermi questo piano? Posso partire dallo **Step 1** (solo report, zero modifiche al codice).
