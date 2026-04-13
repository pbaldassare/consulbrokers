

## Piano: Dropdown dinamici per dati veicolo RCA

### Stato attuale
- **Settore** e **Uso**: già gestiti dalle tabelle `rca_settori` e `rca_usi` con relazione gerarchica
- **Marca/Modello**: campi testo liberi senza validazione
- **Classe B/M**: campo testo libero
- **Tipo Veicolo**: campo testo libero

### Cosa fare

#### 1. Dropdown Classe di Merito (statico)
Creare un array statico con le 18 classi CU (1-18) per un semplice `<Select>`. Non serve tabella DB.

#### 2. Dropdown Marca (API NHTSA)
Usare l'API gratuita NHTSA vPIC per popolare il dropdown marca:
- Endpoint: `https://vpic.nhtsa.dot.gov/api/vehicles/GetAllMakes?format=json`
- Caricare una volta e cacheare (sono ~10.000 marche)
- Usare `SearchableSelect` per filtrare digitando

#### 3. Dropdown Modello (API NHTSA, dipendente dalla marca)
Quando l'utente seleziona una marca, caricare i modelli:
- Endpoint: `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/{marca}?format=json`
- Dropdown filtrato con `SearchableSelect`

#### 4. Dropdown Tipo Veicolo (statico da settore)
Mappare i 16 settori ai tipi veicolo standard (AUTOVETTURA, AUTOCARRO, MOTOCICLO, ecc.) con un array statico.

#### 5. Dropdown Settore e Uso (da DB, già esistenti)
Collegare i dropdown esistenti `rca_settori` → `rca_usi` (filtro gerarchico per settore_id) nel form di immissione veicolo.

### File coinvolti
| File | Azione |
|------|--------|
| `src/hooks/useNHTSAVehicles.ts` | Nuovo hook per fetch marche e modelli da API NHTSA |
| `src/lib/rcaConstants.ts` | Array statici per classi BM (1-18) e tipi veicolo |
| Form immissione veicolo (da identificare) | Sostituire input testo con SearchableSelect per marca, modello, classe BM, settore, uso |

### Note tecniche
- L'API NHTSA è gratuita e non richiede API key
- Le marche vengono cachate in memoria dopo il primo fetch
- I modelli vengono caricati on-demand alla selezione della marca
- Settore e Uso usano le tabelle `rca_settori`/`rca_usi` già popolate

