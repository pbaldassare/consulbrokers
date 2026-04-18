
## Richiesta utente

L'utente vuole che marca/modello auto comuni siano in database (non più solo da NHTSA API), ma mantenendo la possibilità di inserimento manuale (free text).

## Esplorazione necessaria

1. `src/hooks/useNHTSAVehicles.ts` — hook attuale che usa NHTSA
2. Dove viene usato (form RCA) — cercare consumatori
3. Schema attuale: c'è già una tabella per veicoli? Verifico

## Piano

### Step 1 — Database
Creare due tabelle nuove:

**`veicoli_marche`**
- `id uuid PK`
- `nome text UNIQUE NOT NULL` (uppercase)
- `popolare boolean default false`
- `attivo boolean default true`
- `created_at timestamptz default now()`

**`veicoli_modelli`**
- `id uuid PK`
- `marca_id uuid FK → veicoli_marche(id) ON DELETE CASCADE`
- `nome text NOT NULL` (uppercase)
- `popolare boolean default false`
- `attivo boolean default true`
- UNIQUE (marca_id, nome)

**RLS**: lettura per tutti gli authenticated; INSERT/UPDATE per ruoli staff (non cliente/prospect).

**Seed**: popolare con marche/modelli più comuni in Italia:
- Marche: FIAT, VOLKSWAGEN, FORD, OPEL, RENAULT, PEUGEOT, CITROEN, TOYOTA, NISSAN, HYUNDAI, KIA, BMW, MERCEDES-BENZ, AUDI, ALFA ROMEO, LANCIA, JEEP, DACIA, SKODA, SEAT, MINI, SMART, VOLVO, MAZDA, HONDA, SUZUKI, MITSUBISHI, LAND ROVER, JAGUAR, PORSCHE, TESLA, DR, MG.
- Modelli: per ogni marca, 8-15 modelli più diffusi (es. FIAT: PANDA, 500, PUNTO, TIPO, 500X, 500L, BRAVO, DOBLO, DUCATO, QUBO; VW: GOLF, POLO, PASSAT, T-ROC, TIGUAN, UP!, ID.3, ID.4, TOUAREG, TOURAN; etc.)

### Step 2 — Hook nuovo
Sostituire/affiancare `useNHTSAVehicles.ts` con `useVehicleLookup.ts` che legge da DB:
- `useVehicleMakes()` → query `veicoli_marche` ordinata per `popolare DESC, nome ASC`
- `useVehicleModels(marcaNome)` → join su `veicoli_marche.nome` → modelli ordinati per popolare/nome
- Mutation `addMarca(nome)` e `addModello(marcaId, nome)` per inserimento manuale on-the-fly

### Step 3 — UI nel form RCA
Sostituire i due `SearchableSelect` esistenti:
- Componente custom `MarcaCombobox` / `ModelloCombobox` basato su `Command` di shadcn:
  - Mostra opzioni da DB
  - In fondo alla lista, se la query di ricerca non matcha esattamente, mostra: **"+ Aggiungi: «{testo}»"** che chiama la mutation di insert e seleziona il valore.
  - Auto-uppercase del valore inserito.
- Il valore selezionato resta una stringa (compatibile con form RCA esistente).

### Step 4 — Cleanup
- Rimuovere o lasciare deprecato `useNHTSAVehicles.ts` (non più chiamato)
- Aggiornare memoria `mem://insurance/rca-auto-specific-data` rimuovendo riferimento NHTSA → DB locale.

## File toccati

- Nuova migration: tabelle + RLS + seed dati
- `src/hooks/useVehicleLookup.ts` (nuovo)
- `src/components/rca/MarcaModelloCombobox.tsx` (nuovo) 
- Form RCA che usa marca/modello (da identificare in esplorazione: probabilmente `ImmissionePolizzaPage.tsx` o un sub-componente RCA)
- Aggiornamento memoria

## Cosa NON cambia

- Schema `titoli` (marca/modello restano stringhe)
- Validazioni RCA esistenti
- Form layout
