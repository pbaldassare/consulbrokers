

## Piano: Aggiornare polizza AXKY130P (CONSULBROKERS S.p.A. - R.C. MOTO)

Record ID: `e32fcd8f-b583-4d78-bf54-2600106d0f0d`

### 1) UPDATE `titoli` — campi da correggere/popolare

| Campo | Valore DB | Valore Legacy |
|-------|-----------|---------------|
| `numero_titolo` | AXKY13OP | **AXKY130P** (zero, non lettera O) |
| `compagnia_id` | b789d0de (BG0058 ZURICH) | **963c5c51 (ZUR100 ZURICH INSURANCE PLC)** |
| `id_legacy` | null | **142743** |
| `descrizione_polizza` | null | **TG. DA62414 X MAX 250 - MAURIZIO** |
| `durata_da` | null | **2022-04-20** |
| `durata_a` | null | **2026-04-20** |
| `garanzia_da` | null | **2025-04-20** |
| `garanzia_a` | 2026-04-27 | **2026-04-20** |
| `data_scadenza` | 2026-04-20 | OK |
| `data_competenza` | null | **2025-05-13** |
| `comp_assicurativa` | null | **2025-05-13** |
| `data_incasso` | null | **2025-05-13** |
| `anni_durata` | 1 | **4** (poliennale 2022-2026) |
| `disdetta_mesi` | 2 | **3** |
| `no_calcolo_tasse` | false | **true** |
| `premio_netto` | null | **175.48** |
| `addizionali` | 0 | **19.09** |
| `tasse` | null | **48.43** |
| `premio_lordo` | 243 | OK |
| `provvigioni_firma` | 20 | OK |
| `premio_netto_quietanza` | null | **175.48** |
| `addizionali_quietanza` | 0 | **19.09** |
| `tasse_quietanza` | null | **48.43** |
| `provvigioni_quietanza` | 0 | **20.00** |
| `tipo_scadenza` | null | **no scadenza** |
| `giorni_presentazione` | null | **0** |
| `tipo_portafoglio` | null | **POLIZZE FAMIGLIA FIORE** |
| `gruppo_ramo` | null | **R.C.A.** |
| `targa_telaio` | null | **DA62414** |
| `conto_incasso` | null | **CASSA NAPOLI** |

### 2) INSERT `veicoli_polizza`

| Campo | Valore |
|-------|--------|
| settore | Ciclomotori o Motoveicoli per trasporto cose |
| tipo_veicolo | MOTOCICLO |
| uso | TRASPORTO CONTRO PROPRIO |
| provincia_circolazione | Potenza |
| classe_bm | 04 |
| massimale_1/2/3 | 6000 |
| targa | DA62414 |
| veicolo_descrizione | X MAX 250 - MAURIZIO |
| cv | 0 | kw | 0 | cc | 250 | posti | 0 |
| franchigia | 0.00 |

### 3) INSERT `premi_garanzia_polizza` (7 righe)

| Garanzia | Capitale | Tasso | Firma | Rata | Annuo |
|----------|----------|-------|-------|------|-------|
| RC | null | null | 175.48 | 175.48 | 0.00 |
| Furto/Incendio/Eventi | 0 | 0 | 0 | 0 | 0 |
| Tutela Legale | 0 | 0 | 0 | 0 | 0 |
| ARD | 0 | 0 | 0 | 0 | 0 |
| Kasko/Cristalli | 0 | 0 | 0 | 0 | 0 |
| Ass. Stradale | 0 | 0 | 19.09 | 19.09 | 0 |
| Infortuni | 0 | 0 | 0 | 0 | 0 |

### 4) INSERT `conducenti_polizza`

| Campo | Valore |
|-------|--------|
| nome | CONSULBROKERS SPA |
| indirizzo | VIALE MARCONI, 90 |
| cap | 85100 |
| citta | POTENZA |
| provincia | PZ |

### Azioni
1. UPDATE ~28 campi sulla riga `titoli` via insert tool
2. INSERT veicolo in `veicoli_polizza`
3. INSERT 7 righe garanzia in `premi_garanzia_polizza`
4. INSERT conducente in `conducenti_polizza`

### File coinvolti
Nessun file di codice — solo operazioni dati sul DB.

