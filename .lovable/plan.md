

## Piano: Strutturare i dati specifici RCA Auto

### Analisi degli screenshot

La polizza RCA Auto del vecchio sistema ha **3 sezioni aggiuntive** rispetto alle polizze generiche, che attualmente NON esistono nel nostro DB:

#### 1. DATI VEICOLO
| Campo | Esempio |
|---|---|
| Settore | Autovetture |
| Tipo | AUTOVETTURA |
| Uso | PRIVATO |
| Marca / Modello / Versione | — (dropdown) |
| Targa | FT914NM |
| Veicolo (descrizione) | AUDI A1 GIALLA |
| Immatricolazione | (data) |
| Anno Acquisto | N/A |
| Provincia circolazione | Napoli |
| Classe B/M | 06 |
| Massimali (3 campi) | 0, 0, 0 |
| Peius | (checkbox) |
| Franchigia | 0,00 |
| Temporanea / Carico-Scarico / Competizione / Rimorchio | (checkbox) |
| CV, KW, CC, Posti | 16, 85, 0, 5 |
| Peso: Mot, Rim, Tot | 0, 0, 0 |
| Telaio | (text) |
| Tipologia guida | (dropdown) |
| Tipo alimentazione | (dropdown) |

#### 2. DATI PREMIO (breakdown per garanzia)
Righe: RC, Furto/Incendio/Eventi, Tutela Legale, ARD (varie), Kasko/Cristalli, Ass. Stradale, Infortuni + Subtotale, SSN, Tasse, Totale.
Colonne per riga: Capitale, Tasso, Firma, Rata, Annuo.

#### 3. DATI CONDUCENTE
Nome, Indirizzo, CAP/Citta/Prov, Data nascita, Tipo patente, Data rilascio, Note.

### Cosa fare

**1. Nuova tabella DB: `veicoli_polizza`**
Contiene tutti i dati veicolo legati a un titolo (relazione 1:1 con `titoli`):
- `id`, `titolo_id` (FK UNIQUE → titoli)
- `settore` (text: Autovetture, Motocicli, Ciclomotori, Autocarri...)
- `tipo_veicolo` (text: AUTOVETTURA, MOTOCICLO...)
- `uso` (text: PRIVATO, PUBBLICO, PROMISCUO...)
- `marca`, `modello`, `versione`
- `targa`, `telaio`, `veicolo_descrizione`
- `data_immatricolazione`, `anno_acquisto`
- `provincia_circolazione`
- `classe_bm` (text)
- `massimale_1`, `massimale_2`, `massimale_3` (numeric)
- `peius` (boolean), `franchigia` (numeric)
- `temporanea`, `carico_scarico`, `competizione`, `rimorchio` (boolean)
- `cv`, `kw`, `cc`, `posti` (integer)
- `peso_motrice`, `peso_rimorchio`, `peso_totale` (integer)
- `tipologia_guida`, `tipo_alimentazione` (text)

**2. Nuova tabella DB: `premi_garanzia_polizza`**
Breakdown premi per garanzia (relazione 1:N con `titoli`):
- `id`, `titolo_id` (FK → titoli)
- `garanzia` (text: RC, Furto/Incendio/Eventi, Tutela Legale, ARD, Kasko/Cristalli, Ass. Stradale, Infortuni)
- `capitale`, `tasso`, `firma`, `rata`, `annuo` (numeric)
- `ordine` (integer, per ordinamento display)

**3. Nuova tabella DB: `conducenti_polizza`**
Dati conducente (relazione 1:1 con `titoli`):
- `id`, `titolo_id` (FK UNIQUE → titoli)
- `nome`, `cognome`, `indirizzo`, `cap`, `citta`, `provincia`
- `data_nascita`, `tipo_patente`, `data_rilascio_patente`
- `note`

**4. Aggiornare `ImmissionePolizzaPage.tsx`**
- Quando il ramo selezionato appartiene al gruppo "RCA", mostrare le 3 sezioni aggiuntive (DATI VEICOLO, DATI PREMIO, DATI CONDUCENTE)
- Al salvataggio, inserire i record nelle 3 nuove tabelle

**5. Aggiornare `TitoloDetail.tsx`**
- Nel dettaglio polizza, se il titolo ha un record in `veicoli_polizza`, mostrare le sezioni DATI VEICOLO / DATI PREMIO / DATI CONDUCENTE

**6. Aggiornare `types.ts`**
- Aggiungere i 3 nuovi tipi Supabase

### File da modificare
- **1 migrazione SQL** — crea le 3 tabelle con RLS e indici
- **`src/pages/ImmissionePolizzaPage.tsx`** — sezioni condizionali RCA + salvataggio
- **`src/pages/TitoloDetail.tsx`** — visualizzazione dati veicolo/premio/conducente
- **`src/integrations/supabase/types.ts`** — nuovi tipi

